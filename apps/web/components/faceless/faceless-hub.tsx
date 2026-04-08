'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Plus, Video, Mic2, Loader2, ChevronDown, X, Upload, Check, Wand2,
  RefreshCw, Download, Edit3, ArrowLeft, ArrowRight, Sparkles,
  Settings2, Film, Volume2, Play,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from '@/components/ui/toast'
import { VideoPlayer } from '@/components/ui/video-player'
import { startFacelessGeneration } from '@/lib/api'
import { useVideoStatus } from '@/hooks/use-video-status'
import type { FacelessStyle, VideoFormat, VideoDuration } from '@clyro/shared'

// ── Template catalogue ─────────────────────────────────────────────────────────

type TemplateCategory = 'all' | 'cinematic' | 'animation' | 'typography' | 'handmade' | '3d' | 'retro'

interface StyleTemplate {
  id: FacelessStyle
  label: string
  desc: string
  category: TemplateCategory
  badge?: string
  preview: React.FC<{ selected: boolean }>
}

const TEMPLATE_CATEGORIES: Array<{ id: TemplateCategory; label: string }> = [
  { id: 'all',        label: 'Tous les styles' },
  { id: 'cinematic',  label: 'Cinématique'     },
  { id: 'animation',  label: 'Animation'       },
  { id: 'handmade',   label: 'Fait main'       },
  { id: '3d',         label: '3D & VFX'        },
]

function PreviewCinematic({ selected: _s }: { selected: boolean }) {
  return (
    <div className="relative w-full h-full bg-zinc-900 overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[14%] bg-black z-10" />
      <div className="absolute bottom-0 left-0 right-0 h-[14%] bg-black z-10" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 z-0">
        <div className="w-10 h-10 rounded-full bg-amber-400/20 border border-amber-400/40 flex items-center justify-center mb-1">
          <div className="w-4 h-4 rounded-full bg-amber-400/60" />
        </div>
        <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-amber-300/90 text-center px-2">MISE EN SCÈNE</p>
        <p className="font-mono text-[7px] text-zinc-500 tracking-wider">Lumière — 8K</p>
      </div>
    </div>
  )
}

function PreviewStockVo({ selected: _s }: { selected: boolean }) {
  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: 'linear-gradient(160deg,#0c2340,#1a4a7a,#0f3060)' }}>
      <div className="absolute bottom-0 left-0 right-0 h-1/2 opacity-30" style={{ background: 'linear-gradient(to top,#3b82f6,transparent)' }} />
      {(['top-2 left-2 border-t border-l','top-2 right-2 border-t border-r','bottom-2 left-2 border-b border-l','bottom-2 right-2 border-b border-r'] as const).map((cls) => (
        <div key={cls} className={`absolute w-3 h-3 border-sky-400/60 ${cls}`} />
      ))}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
        <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-sky-300/80">DOCUMENTAIRE</p>
        <div className="w-8 h-px bg-sky-400/40 my-0.5" />
        <p className="font-mono text-[7px] text-sky-500/60 tracking-wider">Stock + Voix</p>
      </div>
    </div>
  )
}

function PreviewWhiteboard({ selected: _s }: { selected: boolean }) {
  return (
    <div className="relative w-full h-full bg-gray-50 overflow-hidden">
      <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'linear-gradient(#555 1px,transparent 1px),linear-gradient(90deg,#555 1px,transparent 1px)', backgroundSize: '16px 16px' }} />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-3">
        <svg viewBox="0 0 80 48" className="w-20 h-12" fill="none">
          <rect x="4" y="4" width="32" height="18" rx="3" stroke="#374151" strokeWidth="1.5" strokeDasharray="2 1"/>
          <line x1="4" y1="32" x2="50" y2="32" stroke="#374151" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="4" y1="40" x2="38" y2="40" stroke="#9ca3af" strokeWidth="1" strokeLinecap="round"/>
          <circle cx="62" cy="24" r="10" stroke="#374151" strokeWidth="1.5" strokeDasharray="2 1"/>
          <line x1="58" y1="24" x2="66" y2="24" stroke="#374151" strokeWidth="1.5"/>
          <line x1="62" y1="20" x2="62" y2="28" stroke="#374151" strokeWidth="1.5"/>
        </svg>
        <p className="font-mono text-[8px] text-gray-500 tracking-wider uppercase">Whiteboard</p>
      </div>
    </div>
  )
}

function PreviewStickman({ selected: _s }: { selected: boolean }) {
  return (
    <div className="relative w-full h-full bg-stone-50 overflow-hidden">
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
        <svg viewBox="0 0 60 60" className="w-14 h-14" fill="none">
          <circle cx="30" cy="12" r="7" stroke="#374151" strokeWidth="2"/>
          <line x1="30" y1="19" x2="30" y2="38" stroke="#374151" strokeWidth="2" strokeLinecap="round"/>
          <line x1="30" y1="27" x2="16" y2="22" stroke="#374151" strokeWidth="2" strokeLinecap="round"/>
          <line x1="30" y1="27" x2="44" y2="22" stroke="#374151" strokeWidth="2" strokeLinecap="round"/>
          <line x1="30" y1="38" x2="20" y2="52" stroke="#374151" strokeWidth="2" strokeLinecap="round"/>
          <line x1="30" y1="38" x2="40" y2="52" stroke="#374151" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <p className="font-mono text-[8px] text-stone-500 tracking-wider uppercase">Stickman</p>
      </div>
    </div>
  )
}

function PreviewFlatDesign({ selected: _s }: { selected: boolean }) {
  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
      <div className="absolute inset-0 flex items-center justify-center gap-2 px-3">
        {(['Planning','Making','Sharing'] as const).map((label) => (
          <div key={label} className="flex flex-col gap-1.5 items-center">
            <div className="w-7 h-7 rounded-lg bg-white/25 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-white/80" />
            </div>
            <p className="font-mono text-[7px] text-white/70 tracking-wider">{label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function Preview3dPixar({ selected: _s }: { selected: boolean }) {
  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: 'linear-gradient(135deg,#fbbf24,#f97316,#fb923c)' }}>
      <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-6 rounded-full bg-white/20 blur-sm" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
        <div className="w-10 h-10 rounded-[40%_60%_55%_45%/50%_45%_55%_50%] bg-amber-600/40 border-2 border-orange-300/60 flex items-center justify-center">
          <div className="flex gap-1">
            <div className="w-2 h-2 rounded-full bg-orange-900/80" />
            <div className="w-2 h-2 rounded-full bg-orange-900/80" />
          </div>
        </div>
        <p className="font-mono text-[8px] text-orange-900/80 tracking-wider uppercase mt-1">3D Pixar</p>
      </div>
    </div>
  )
}

function PreviewMotionGraphics({ selected: _s }: { selected: boolean }) {
  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: 'linear-gradient(135deg,#1e0b3e,#3b0f6e,#1a0a38)' }}>
      <div className="absolute top-3 left-3 w-6 h-6 border border-violet-400/50 rotate-12" />
      <div className="absolute bottom-4 right-3 w-5 h-5 rounded-full border border-fuchsia-400/50" />
      <div className="absolute top-5 right-5 w-3 h-3 bg-violet-500/40 rotate-45" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
        <p className="font-display font-black text-[18px] text-transparent bg-clip-text leading-none" style={{ backgroundImage: 'linear-gradient(90deg,#a855f7,#ec4899)' }}>MOTION</p>
        <p className="font-mono text-[7px] text-violet-400/60 tracking-[0.3em] uppercase">Graphics</p>
      </div>
    </div>
  )
}

function PreviewAnimation2d({ selected: _s }: { selected: boolean }) {
  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: 'linear-gradient(135deg,#ec4899,#f43f5e,#fb7185)' }}>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-2">
        <div className="relative bg-white/90 rounded-xl px-3 py-2 mb-1">
          <p className="font-display font-black text-[10px] text-pink-600 leading-tight">Bonjour!</p>
          <div className="absolute -bottom-1.5 left-4 w-3 h-3 bg-white/90 rotate-45 rounded-sm" />
        </div>
        <p className="font-mono text-[7px] text-white/70 tracking-wider uppercase mt-1">Animation 2D</p>
      </div>
    </div>
  )
}

const STYLE_TEMPLATES: StyleTemplate[] = [
  { id: 'cinematique',     label: 'Cinématique',    desc: 'Lumière dramatique, 8K',          category: 'cinematic', preview: PreviewCinematic    },
  { id: 'stock-vo',        label: 'Stock + VO',      desc: 'Documentaire National Geo',       category: 'cinematic', preview: PreviewStockVo      },
  { id: 'whiteboard',      label: 'Whiteboard',      desc: 'Marqueur sur tableau blanc',      category: 'handmade',  preview: PreviewWhiteboard   },
  { id: 'stickman',        label: 'Bonshommes',      desc: 'Stickman & formes géo',           category: 'handmade',  badge: 'New', preview: PreviewStickman    },
  { id: 'flat-design',     label: 'Flat Design',     desc: 'Illustration plate, couleurs vives', category: 'animation', badge: 'New', preview: PreviewFlatDesign  },
  { id: '3d-pixar',        label: '3D Pixar',        desc: 'Claymation style Pixar',          category: '3d',        badge: 'New', preview: Preview3dPixar     },
  { id: 'motion-graphics', label: 'Motion Graphics', desc: 'Formes géo, typo animée',         category: '3d',        preview: PreviewMotionGraphics },
  { id: 'animation-2d',    label: 'Animation 2D',    desc: 'Dessin animé vectoriel',          category: 'animation', preview: PreviewAnimation2d  },
]

// ── Pipeline types ─────────────────────────────────────────────────────────────

type PipelineStep = 'setup' | 'storyboard' | 'images' | 'clips' | 'final'

interface SceneData {
  id: string
  index: number
  scriptText: string
  imagePrompt: string
  animationPrompt: string
  imageUrl?: string
  imageStatus: 'idle' | 'generating' | 'done' | 'error'
  clipUrl?: string
  clipStatus: 'idle' | 'generating' | 'done' | 'error'
}

interface ProjectState {
  title: string
  style: FacelessStyle | null
  voiceId: string
  format: VideoFormat
  duration: VideoDuration
  description: string
  script: string
  audioFile: File | null
  inputType: 'script' | 'audio'
  scenes: SceneData[]
  step: PipelineStep
  videoId?: string       // set after submitting to backend pipeline
  finalVideoUrl?: string
}

// ── Mock helpers ───────────────────────────────────────────────────────────────

function splitScriptToScenes(script: string): SceneData[] {
  const sentences = script
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15)
  const count = Math.max(Math.min(sentences.length, 6), 3)
  const perScene = Math.ceil(sentences.length / count)
  return Array.from({ length: count }, (_, i) => {
    const chunk = sentences.slice(i * perScene, (i + 1) * perScene).join(' ')
    return {
      id: `scene-${i}-${Date.now()}`,
      index: i,
      scriptText: chunk || `Scène ${i + 1} — description à compléter.`,
      imagePrompt: `Cinematic scene ${i + 1}: ${chunk.slice(0, 60)}..., dramatic lighting, high quality photorealistic`,
      animationPrompt: i % 3 === 0
        ? 'Slow camera pan from left to right, gentle parallax depth'
        : i % 3 === 1
          ? 'Subtle zoom-in, soft bokeh transition'
          : 'Static wide shot with atmospheric particles',
      imageStatus: 'idle',
      clipStatus: 'idle',
    }
  })
}

const FORMATS: Array<{ id: VideoFormat; label: string; desc: string }> = [
  { id: '9:16', label: '9:16', desc: 'TikTok / Reels' },
  { id: '1:1',  label: '1:1',  desc: 'Instagram'      },
  { id: '16:9', label: '16:9', desc: 'YouTube'         },
]

const DURATIONS: Array<{ id: VideoDuration; label: string }> = [
  { id: '15s', label: '15s' },
  { id: '30s', label: '30s' },
  { id: '60s', label: '60s' },
]

interface VoiceItem { id: string; name: string; gender?: string; accent?: string }

// ── Step indicator ─────────────────────────────────────────────────────────────

const PIPELINE_STEPS: Array<{ id: PipelineStep; label: string }> = [
  { id: 'setup',      label: 'Script'      },
  { id: 'storyboard', label: 'Storyboard'  },
  { id: 'images',     label: 'Images'      },
  { id: 'clips',      label: 'Clips'       },
  { id: 'final',      label: 'Vidéo'       },
]

function StepIndicator({ current }: { current: PipelineStep }) {
  const currentIdx = PIPELINE_STEPS.findIndex((s) => s.id === current)
  return (
    <div className="flex items-center gap-1 px-6 py-3 border-b border-brand-border bg-brand-surface shrink-0">
      {PIPELINE_STEPS.map((step, i) => {
        const done   = i < currentIdx
        const active = i === currentIdx
        return (
          <div key={step.id} className="flex items-center gap-1">
            <div className={cn(
              'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-body font-medium transition-all',
              active ? 'bg-brand-primary text-white shadow-sm' :
              done   ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' :
                       'text-brand-muted'
            )}>
              {done
                ? <Check size={10} />
                : <span className="font-mono text-[10px] opacity-60">{i + 1}</span>
              }
              <span>{step.label}</span>
            </div>
            {i < PIPELINE_STEPS.length - 1 && (
              <div className={cn('w-5 h-px', done ? 'bg-emerald-300' : 'bg-brand-border')} />
            )}
          </div>
        )
      })}
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
    <div className="absolute left-0 top-full mt-2 z-50 w-[480px] bg-white border border-brand-border rounded-2xl shadow-xl p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <p className="font-display text-sm font-semibold text-brand-text">Style visuel</p>
        <button type="button" onClick={onClose} aria-label="Fermer" className="text-brand-muted hover:text-brand-text transition-colors"><X size={14} /></button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {STYLE_TEMPLATES.map((s) => {
          const Preview = s.preview
          return (
            <button key={s.id} type="button" onClick={() => { onChange(s.id); onClose() }}
              className={cn('relative rounded-xl overflow-hidden transition-all',
                value === s.id ? 'ring-2 ring-brand-primary ring-offset-1' : 'hover:ring-1 hover:ring-brand-border')}>
              <div className="h-16 w-full relative"><Preview selected={value === s.id} /></div>
              <div className="p-2 bg-brand-surface">
                <p className="font-display font-semibold text-[11px] text-brand-text truncate">{s.label}</p>
              </div>
              {s.badge && <span className="absolute top-1 right-1 font-mono text-[8px] uppercase tracking-wider bg-brand-primary text-white px-1 py-0.5 rounded-full">{s.badge}</span>}
              {value === s.id && <div className="absolute top-1 left-1 w-4 h-4 rounded-full bg-brand-primary flex items-center justify-center"><Check size={8} className="text-white" /></div>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Voice picker dropdown ──────────────────────────────────────────────────────

function VoicePickerDropdown({ value, voices, onChange, onClose }: {
  value: string; voices: VoiceItem[]; onChange: (id: string) => void; onClose: () => void
}) {
  return (
    <div className="absolute left-0 top-full mt-2 z-50 w-64 bg-white border border-brand-border rounded-2xl shadow-xl p-3 animate-fade-in">
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
            {(v.gender || v.accent) && <p className="text-[11px] text-brand-muted">{[v.gender, v.accent].filter(Boolean).join(' · ')}</p>}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Template gallery ───────────────────────────────────────────────────────────

function TemplateGallery({ selected, onSelect }: { selected: FacelessStyle | null; onSelect: (id: FacelessStyle) => void }) {
  const [activeCategory, setActiveCategory] = useState<TemplateCategory>('all')
  const filtered = activeCategory === 'all' ? STYLE_TEMPLATES : STYLE_TEMPLATES.filter((t) => t.category === activeCategory)

  return (
    <div className="border-t border-brand-border px-6 py-8 bg-brand-surface/50">
      <div className="max-w-2xl mx-auto">
        <p className="font-display text-base font-semibold text-brand-text mb-4">Styles disponibles</p>
        <div className="flex flex-wrap gap-2 mb-5">
          {TEMPLATE_CATEGORIES.map((cat) => (
            <button key={cat.id} type="button" onClick={() => setActiveCategory(cat.id)}
              className={cn('px-3.5 py-1.5 rounded-full text-xs font-body font-medium border transition-all',
                activeCategory === cat.id
                  ? 'bg-brand-primary-light border-brand-primary text-brand-primary'
                  : 'bg-brand-surface border-brand-border text-brand-muted hover:border-brand-primary/40 hover:text-brand-text')}>
              {cat.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {filtered.map((t) => {
            const Preview = t.preview
            const isSelected = selected === t.id
            return (
              <button key={t.id} type="button" onClick={() => onSelect(t.id)}
                className={cn('relative rounded-2xl overflow-hidden text-left transition-all',
                  isSelected ? 'ring-2 ring-brand-primary ring-offset-2' : 'hover:scale-[1.02] hover:shadow-brand-md')}>
                <div className="h-24 w-full relative"><Preview selected={isSelected} /></div>
                <div className="p-2.5 bg-brand-surface border-t border-brand-border/50">
                  <p className="font-display font-bold text-[11px] text-brand-text">{t.label}</p>
                  <p className="font-body text-[10px] text-brand-muted mt-0.5 leading-tight">{t.desc}</p>
                </div>
                {t.badge && <span className="absolute top-2 right-2 font-mono text-[8px] uppercase tracking-wider bg-brand-primary text-white px-1.5 py-0.5 rounded-full">{t.badge}</span>}
                {isSelected && <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-brand-primary flex items-center justify-center shadow"><Check size={9} className="text-white" /></div>}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Step 1 — Setup ─────────────────────────────────────────────────────────────

function SetupStep({ project, onChange, onNext }: {
  project: ProjectState
  onChange: (patch: Partial<ProjectState>) => void
  onNext: () => void
}) {
  const [voices] = useState<VoiceItem[]>([])
  const [showStylePicker, setShowStylePicker] = useState(false)
  const [showVoicePicker, setShowVoicePicker] = useState(false)
  const [showSettings,    setShowSettings]    = useState(false)
  const styleRef = useRef<HTMLDivElement>(null)
  const voiceRef = useRef<HTMLDivElement>(null)
  const fileRef  = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (styleRef.current && !styleRef.current.contains(e.target as Node)) setShowStylePicker(false)
      if (voiceRef.current && !voiceRef.current.contains(e.target as Node)) setShowVoicePicker(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const selectedStyle = STYLE_TEMPLATES.find((s) => s.id === project.style)
  const selectedVoice = voices.find((v) => v.id === project.voiceId)

  const canNext = !!project.style && (
    project.inputType === 'script' ? project.script.trim().length >= 20 : !!project.audioFile
  )

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex flex-col items-center justify-center flex-1 px-6 py-8 min-h-[480px]">
        <div className="w-full max-w-2xl space-y-5">

          {/* Headline */}
          <div className="text-center">
            <h1 className="font-display text-2xl font-bold text-brand-text mb-1">Crée ta vidéo Faceless</h1>
            <p className="font-body text-sm text-brand-muted">Décris le contenu, colle ton script, choisis ton style — l'IA fait le reste scène par scène.</p>
          </div>

          {/* Description */}
          <div className="rounded-2xl border border-brand-border bg-brand-surface overflow-hidden">
            <div className="px-4 pt-4 pb-2">
              <p className="font-mono text-[10px] uppercase tracking-widest text-brand-muted mb-2">Description du contenu</p>
              <textarea
                value={project.description}
                onChange={(e) => onChange({ description: e.target.value })}
                placeholder="Décris ta vidéo : personnages, ambiance, message principal... Ex : une vidéo éducative sur les trous noirs avec un narrateur scientifique et des animations spatiales."
                rows={3}
                className="w-full bg-transparent text-brand-text font-body text-sm placeholder:text-brand-muted focus:outline-none resize-none"
              />
            </div>
          </div>

          {/* Script / Audio */}
          <div className="rounded-2xl border border-brand-border bg-brand-surface overflow-hidden">
            {/* Tab bar */}
            <div className="flex items-center gap-1 px-4 pt-3 mb-2">
              <p className="font-mono text-[10px] uppercase tracking-widest text-brand-muted flex-1">
                {project.inputType === 'script' ? 'Script' : 'Audio'}
              </p>
              <div className="flex items-center gap-1 bg-brand-bg border border-brand-border rounded-xl p-0.5">
                <button type="button" onClick={() => onChange({ inputType: 'script' })}
                  className={cn('px-3 py-1 rounded-lg text-xs font-mono transition-all', project.inputType === 'script' ? 'bg-white shadow-sm text-brand-text' : 'text-brand-muted hover:text-brand-text')}>
                  Script
                </button>
                <button type="button" onClick={() => onChange({ inputType: 'audio' })}
                  className={cn('px-3 py-1 rounded-lg text-xs font-mono transition-all', project.inputType === 'audio' ? 'bg-white shadow-sm text-brand-text' : 'text-brand-muted hover:text-brand-text')}>
                  Audio
                </button>
              </div>
            </div>

            {project.inputType === 'script' ? (
              <textarea
                value={project.script}
                onChange={(e) => onChange({ script: e.target.value })}
                placeholder="Colle ou écris ton script complet ici. L'IA le découpera automatiquement en scènes et générera les prompts visuels pour chacune."
                maxLength={8000}
                rows={6}
                className="w-full bg-transparent px-4 pb-3 text-brand-text font-body text-sm placeholder:text-brand-muted focus:outline-none resize-none"
              />
            ) : (
              <div className="px-4 pb-4">
                <label htmlFor="faceless-audio"
                  className={cn('flex flex-col items-center justify-center h-28 rounded-xl border-2 border-dashed cursor-pointer transition-all',
                    project.audioFile ? 'border-brand-primary bg-brand-primary-light' : 'border-brand-border hover:border-brand-primary/50')}>
                  <Upload size={18} className={cn('mb-2', project.audioFile ? 'text-brand-primary' : 'text-brand-muted')} />
                  <p className="font-display text-sm font-semibold text-brand-text">{project.audioFile ? project.audioFile.name : 'Importer un fichier audio'}</p>
                  <p className="text-xs text-brand-muted mt-0.5">MP3, WAV, M4A — max 50 MB</p>
                  <input ref={fileRef} id="faceless-audio" type="file" accept="audio/*" className="hidden"
                    onChange={(e) => onChange({ audioFile: e.target.files?.[0] ?? null })} />
                </label>
              </div>
            )}

            {project.inputType === 'script' && (
              <div className="px-4 pb-2">
                <span className={cn('font-mono text-[10px]', project.script.length < 20 ? 'text-red-400' : 'text-brand-muted')}>
                  {project.script.length}/8000{project.script.length < 20 && ` · encore ${20 - project.script.length} car.`}
                </span>
              </div>
            )}
          </div>

          {/* Style + Voice row */}
          <div className="flex flex-wrap gap-2 items-center">
            {/* Style */}
            <div ref={styleRef} className="relative">
              <button type="button" onClick={() => { setShowStylePicker((v) => !v); setShowVoicePicker(false) }}
                className={cn('flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-body transition-all',
                  project.style ? 'bg-brand-primary-light border-brand-primary text-brand-primary' : 'bg-brand-bg border-brand-border text-brand-muted hover:border-brand-primary/40')}>
                <span className="font-medium">{selectedStyle?.label ?? 'Style visuel'}</span>
                <ChevronDown size={13} className={cn('transition-transform', showStylePicker && 'rotate-180')} />
              </button>
              {showStylePicker && <StylePickerDropdown value={project.style} onChange={(s) => onChange({ style: s })} onClose={() => setShowStylePicker(false)} />}
            </div>

            {/* Voice */}
            <div ref={voiceRef} className="relative">
              <button type="button" onClick={() => { setShowVoicePicker((v) => !v); setShowStylePicker(false) }}
                className={cn('flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-body transition-all',
                  project.voiceId ? 'bg-brand-primary-light border-brand-primary text-brand-primary' : 'bg-brand-bg border-brand-border text-brand-muted hover:border-brand-primary/40')}>
                <Mic2 size={14} />
                <span className="font-medium">{selectedVoice?.name ?? 'Voix off'}</span>
                <ChevronDown size={13} className={cn('transition-transform', showVoicePicker && 'rotate-180')} />
              </button>
              {showVoicePicker && <VoicePickerDropdown value={project.voiceId} voices={voices} onChange={(id) => onChange({ voiceId: id })} onClose={() => setShowVoicePicker(false)} />}
            </div>

            {/* Settings */}
            <button type="button" aria-label="Paramètres" onClick={() => setShowSettings((v) => !v)}
              className={cn('w-9 h-9 rounded-xl flex items-center justify-center border transition-all',
                showSettings ? 'bg-brand-primary-light border-brand-primary text-brand-primary' : 'bg-brand-bg border-brand-border text-brand-muted hover:text-brand-text')}>
              <Settings2 size={14} />
            </button>

            {/* Spacer + Title */}
            <input type="text" value={project.title} onChange={(e) => onChange({ title: e.target.value })}
              placeholder="Titre (auto si vide)"
              className="ml-auto hidden sm:block flex-1 max-w-xs bg-brand-surface border border-brand-border rounded-xl px-3 py-2 text-brand-text font-body text-sm placeholder:text-brand-muted focus:outline-none focus:border-brand-primary transition-colors" />

            {/* Generate storyboard */}
            <button type="button" onClick={onNext} disabled={!canNext}
              className={cn('flex items-center gap-2 px-5 py-2.5 rounded-xl font-display font-semibold text-sm transition-all ml-auto',
                canNext ? 'bg-gray-900 text-white hover:bg-gray-800' : 'bg-brand-bg border border-brand-border text-brand-muted cursor-not-allowed')}>
              <Sparkles size={14} />
              Générer le storyboard
              <ArrowRight size={13} />
            </button>
          </div>

          {/* Settings panel */}
          {showSettings && (
            <div className="rounded-2xl border border-brand-border bg-brand-bg/60 p-4 space-y-4">
              <div className="flex gap-6 flex-wrap">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-brand-muted mb-2">Format</p>
                  <div className="flex gap-1.5">
                    {FORMATS.map((f) => (
                      <button key={f.id} type="button" title={f.desc} onClick={() => onChange({ format: f.id })}
                        className={cn('px-3 py-1.5 rounded-lg border text-xs font-display font-semibold transition-all',
                          project.format === f.id ? 'bg-brand-primary-light border-brand-primary text-brand-primary' : 'bg-brand-bg border-brand-border text-brand-muted hover:border-brand-primary/40')}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-brand-muted mb-2">Durée</p>
                  <div className="flex gap-1.5">
                    {DURATIONS.map((d) => (
                      <button key={d.id} type="button" onClick={() => onChange({ duration: d.id })}
                        className={cn('px-3 py-1.5 rounded-lg border text-xs font-display font-semibold transition-all',
                          project.duration === d.id ? 'bg-brand-primary-light border-brand-primary text-brand-primary' : 'bg-brand-bg border-brand-border text-brand-muted hover:border-brand-primary/40')}>
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Template gallery */}
      <TemplateGallery selected={project.style} onSelect={(s) => onChange({ style: s })} />
    </div>
  )
}

// ── Step 2 — Storyboard ────────────────────────────────────────────────────────

function StoryboardStep({ scenes, onScenesChange, onBack, onNext }: {
  scenes: SceneData[]
  onScenesChange: (scenes: SceneData[]) => void
  onBack: () => void
  onNext: () => void
}) {
  const [generating, setGenerating] = useState(false)
  const [editingId,  setEditingId]  = useState<string | null>(null)

  function updateScene(id: string, patch: Partial<SceneData>) {
    onScenesChange(scenes.map((s) => s.id === id ? { ...s, ...patch } : s))
  }

  async function regenScene(id: string) {
    updateScene(id, { imageStatus: 'generating' })
    await new Promise((r) => setTimeout(r, 1200))
    updateScene(id, { imageStatus: 'idle', imagePrompt: scenes.find((s) => s.id === id)!.imagePrompt + ' [régénéré]' })
  }

  async function regenAll() {
    setGenerating(true)
    await new Promise((r) => setTimeout(r, 2000))
    setGenerating(false)
    toast.success('Storyboard régénéré')
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-brand-border shrink-0">
        <div>
          <h2 className="font-display text-base font-bold text-brand-text">Storyboard</h2>
          <p className="font-body text-xs text-brand-muted">{scenes.length} scènes générées — modifie le script et les prompts avant de générer les images</p>
        </div>
        <button type="button" onClick={regenAll} disabled={generating}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-brand-border text-xs font-body text-brand-muted hover:text-brand-text hover:border-brand-primary/40 transition-all">
          {generating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          Tout régénérer
        </button>
      </div>

      {/* Scenes list */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {scenes.map((scene, i) => (
          <div key={scene.id} className="rounded-2xl border border-brand-border bg-brand-surface overflow-hidden">
            {/* Scene header */}
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-brand-border/60 bg-brand-bg/40">
              <span className="font-mono text-[10px] font-bold text-brand-primary bg-brand-primary-light px-2 py-0.5 rounded-full">
                Scène {i + 1}
              </span>
              <div className="flex-1" />
              <button type="button" onClick={() => setEditingId(editingId === scene.id ? null : scene.id)}
                className={cn('flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all', editingId === scene.id ? 'bg-brand-primary-light text-brand-primary' : 'text-brand-muted hover:text-brand-text')}>
                <Edit3 size={11} />
                {editingId === scene.id ? 'Fermer' : 'Modifier'}
              </button>
              <button type="button" onClick={() => regenScene(scene.id)}
                disabled={scene.imageStatus === 'generating'}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-brand-muted hover:text-brand-text transition-all">
                {scene.imageStatus === 'generating' ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                Régénérer
              </button>
            </div>

            <div className="p-4 space-y-3">
              {/* Script text */}
              <div>
                <p className="font-mono text-[9px] uppercase tracking-widest text-brand-muted mb-1.5">Script de la scène</p>
                {editingId === scene.id ? (
                  <textarea value={scene.scriptText} onChange={(e) => updateScene(scene.id, { scriptText: e.target.value })}
                    rows={3} placeholder="Texte du script pour cette scène…"
                    className="w-full bg-brand-bg border border-brand-border rounded-xl px-3 py-2 text-sm font-body text-brand-text focus:outline-none focus:border-brand-primary transition-colors resize-none" />
                ) : (
                  <p className="text-sm font-body text-brand-text leading-relaxed">{scene.scriptText}</p>
                )}
              </div>

              {/* Prompts */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-brand-bg rounded-xl p-3 border border-brand-border/60">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div className="w-3 h-3 rounded bg-sky-200 flex items-center justify-center">
                      <span className="text-[8px]">🖼</span>
                    </div>
                    <p className="font-mono text-[9px] uppercase tracking-widest text-brand-muted">Prompt image</p>
                  </div>
                  {editingId === scene.id ? (
                    <textarea value={scene.imagePrompt} onChange={(e) => updateScene(scene.id, { imagePrompt: e.target.value })}
                      rows={3} placeholder="Prompt image pour cette scène…"
                      className="w-full bg-white border border-brand-border rounded-lg px-2 py-1.5 text-xs font-mono text-brand-text focus:outline-none focus:border-brand-primary transition-colors resize-none" />
                  ) : (
                    <p className="text-xs font-mono text-brand-muted leading-relaxed line-clamp-3">{scene.imagePrompt}</p>
                  )}
                </div>
                <div className="bg-brand-bg rounded-xl p-3 border border-brand-border/60">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div className="w-3 h-3 rounded bg-violet-200 flex items-center justify-center">
                      <span className="text-[8px]">🎬</span>
                    </div>
                    <p className="font-mono text-[9px] uppercase tracking-widest text-brand-muted">Prompt animation</p>
                  </div>
                  {editingId === scene.id ? (
                    <textarea value={scene.animationPrompt} onChange={(e) => updateScene(scene.id, { animationPrompt: e.target.value })}
                      rows={3} placeholder="Prompt animation pour cette scène…"
                      className="w-full bg-white border border-brand-border rounded-lg px-2 py-1.5 text-xs font-mono text-brand-text focus:outline-none focus:border-brand-primary transition-colors resize-none" />
                  ) : (
                    <p className="text-xs font-mono text-brand-muted leading-relaxed line-clamp-3">{scene.animationPrompt}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer navigation */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-brand-border bg-brand-surface shrink-0">
        <button type="button" onClick={onBack} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-brand-border text-sm font-body text-brand-muted hover:text-brand-text transition-all">
          <ArrowLeft size={14} /> Retour
        </button>
        <button type="button" onClick={onNext} className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gray-900 text-white font-display font-semibold text-sm hover:bg-gray-800 transition-all">
          Générer les images <ArrowRight size={13} />
        </button>
      </div>
    </div>
  )
}

// ── Step 3 — Images ────────────────────────────────────────────────────────────

// Placeholder image colors per scene index
const SCENE_COLORS = [
  'from-slate-800 via-zinc-700 to-slate-900',
  'from-sky-900 via-blue-800 to-sky-900',
  'from-emerald-800 via-teal-700 to-emerald-900',
  'from-violet-900 via-purple-800 to-indigo-900',
  'from-orange-800 via-amber-700 to-orange-900',
  'from-rose-900 via-pink-800 to-rose-900',
]

function ImagesStep({ scenes, style, onScenesChange, onBack, onNext }: {
  scenes: SceneData[]
  style: FacelessStyle
  onScenesChange: (scenes: SceneData[]) => void
  onBack: () => void
  onNext: () => void
}) {
  const [generatingAll, setGeneratingAll] = useState(false)
  const [editingId,     setEditingId]     = useState<string | null>(null)

  function updateScene(id: string, patch: Partial<SceneData>) {
    onScenesChange(scenes.map((s) => s.id === id ? { ...s, ...patch } : s))
  }

  async function generateImage(id: string) {
    const scene = scenes.find((s) => s.id === id)
    if (!scene) return
    updateScene(id, { imageStatus: 'generating' })
    try {
      const res = await fetch('/api/generate-scene-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: scene.imagePrompt, style }),
      })
      if (!res.ok) throw new Error('Image generation failed')
      const data = await res.json() as { imageUrl: string }
      updateScene(id, { imageStatus: 'done', imageUrl: data.imageUrl })
    } catch {
      toast.error(`Erreur image scène ${scene.index + 1}`)
      updateScene(id, { imageStatus: 'error' })
    }
  }

  async function generateAll() {
    setGeneratingAll(true)
    const pending = scenes.filter((s) => s.imageStatus !== 'done')
    await Promise.all(pending.map((s) => generateImage(s.id)))
    setGeneratingAll(false)
    toast.success('Toutes les images générées !')
  }

  const allDone = scenes.every((s) => s.imageStatus === 'done')
  const doneCnt = scenes.filter((s) => s.imageStatus === 'done').length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-brand-border shrink-0">
        <div>
          <h2 className="font-display text-base font-bold text-brand-text">Génération des images</h2>
          <p className="font-body text-xs text-brand-muted">{doneCnt}/{scenes.length} images générées</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={generateAll} disabled={generatingAll || allDone}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-brand-border text-xs font-body text-brand-muted hover:text-brand-text hover:border-brand-primary/40 transition-all disabled:opacity-40">
            {generatingAll ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {allDone ? 'Toutes générées' : generatingAll ? 'Génération…' : 'Générer toutes'}
          </button>
        </div>
      </div>

      {/* Image grid */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="grid grid-cols-3 gap-4">
          {scenes.map((scene, i) => (
            <div key={scene.id} className="rounded-2xl border border-brand-border overflow-hidden bg-brand-surface">
              {/* Image preview */}
              <div className={cn('h-36 relative bg-gradient-to-br', SCENE_COLORS[i % SCENE_COLORS.length])}>
                {scene.imageStatus === 'generating' ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                    <Loader2 size={24} className="text-white/60 animate-spin" />
                    <p className="font-mono text-[9px] text-white/50 uppercase tracking-widest">Génération…</p>
                  </div>
                ) : scene.imageStatus === 'done' ? (
                  scene.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={scene.imageUrl} alt={`Scène ${i + 1}`} className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-3">
                      <Check size={14} className="text-white" />
                    </div>
                  )
                ) : scene.imageStatus === 'error' ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                    <X size={18} className="text-red-300" />
                    <p className="font-mono text-[9px] text-red-300 uppercase tracking-wider">Erreur</p>
                  </div>
                ) : (
                  <button type="button" onClick={() => generateImage(scene.id)}
                    className="absolute inset-0 flex flex-col items-center justify-center gap-2 hover:bg-white/5 transition-colors group">
                    <div className="w-10 h-10 rounded-full border-2 border-white/30 group-hover:border-white/60 flex items-center justify-center transition-all">
                      <Play size={14} className="text-white/60 group-hover:text-white transition-colors" />
                    </div>
                    <p className="font-mono text-[9px] text-white/40 group-hover:text-white/70 uppercase tracking-widest transition-colors">Générer</p>
                  </button>
                )}

                {/* Scene badge */}
                <span className="absolute top-2 left-2 font-mono text-[9px] uppercase tracking-wider bg-black/50 text-white px-2 py-0.5 rounded-full">
                  Scène {i + 1}
                </span>

                {/* Edit / regen controls */}
                <div className="absolute top-2 right-2 flex items-center gap-1">
                  <button type="button" aria-label="Modifier le prompt" onClick={() => setEditingId(editingId === scene.id ? null : scene.id)}
                    className={cn('w-6 h-6 rounded-lg flex items-center justify-center transition-all', editingId === scene.id ? 'bg-brand-primary text-white' : 'bg-black/40 text-white/70 hover:bg-black/60')}>
                    <Edit3 size={10} />
                  </button>
                  <button type="button" aria-label="Régénérer l'image" onClick={() => generateImage(scene.id)} disabled={scene.imageStatus === 'generating'}
                    className="w-6 h-6 rounded-lg bg-black/40 text-white/70 hover:bg-black/60 flex items-center justify-center transition-all disabled:opacity-40">
                    <RefreshCw size={10} />
                  </button>
                </div>
              </div>

              {/* Script excerpt */}
              <div className="p-3">
                {editingId === scene.id ? (
                  <div className="space-y-2">
                    <textarea value={scene.imagePrompt}
                      onChange={(e) => updateScene(scene.id, { imagePrompt: e.target.value })}
                      placeholder="Prompt image…" rows={3}
                      className="w-full bg-brand-bg border border-brand-border rounded-lg px-2 py-1.5 text-[11px] font-mono text-brand-text focus:outline-none focus:border-brand-primary resize-none" />
                    <button type="button" onClick={() => { generateImage(scene.id); setEditingId(null) }}
                      className="w-full py-1.5 rounded-lg bg-brand-primary text-white text-xs font-display font-semibold hover:bg-brand-primary/90 transition-all">
                      Régénérer avec ce prompt
                    </button>
                  </div>
                ) : (
                  <p className="text-[11px] font-body text-brand-muted leading-snug line-clamp-3">{scene.scriptText}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-brand-border bg-brand-surface shrink-0">
        <button type="button" onClick={onBack} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-brand-border text-sm font-body text-brand-muted hover:text-brand-text transition-all">
          <ArrowLeft size={14} /> Retour
        </button>
        <div className="flex items-center gap-3">
          {!allDone && (
            <p className="text-xs font-body text-brand-muted">{scenes.length - doneCnt} image(s) restante(s)</p>
          )}
          <button type="button" onClick={onNext} disabled={!allDone}
            className={cn('flex items-center gap-2 px-5 py-2 rounded-xl font-display font-semibold text-sm transition-all',
              allDone ? 'bg-gray-900 text-white hover:bg-gray-800' : 'bg-brand-bg border border-brand-border text-brand-muted cursor-not-allowed')}>
            Générer les clips <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Step 4 — Clips + Voice-over ────────────────────────────────────────────────

function ClipsStep({ scenes, onScenesChange, voiceId, onBack, onNext }: {
  scenes: SceneData[]
  onScenesChange: (scenes: SceneData[]) => void
  voiceId: string
  onBack: () => void
  onNext: () => void
}) {
  const [generatingAll,  setGeneratingAll]  = useState(false)
  const [voiceStatus,    setVoiceStatus]    = useState<'idle' | 'generating' | 'done'>('idle')
  const [editingId,      setEditingId]      = useState<string | null>(null)

  function updateScene(id: string, patch: Partial<SceneData>) {
    onScenesChange(scenes.map((s) => s.id === id ? { ...s, ...patch } : s))
  }

  async function generateClip(id: string) {
    // Clips + voice are handled server-side in the pipeline job
    // Mark all as done optimistically when user submits
    updateScene(id, { clipStatus: 'done' })
  }

  async function generateVoice() {
    setVoiceStatus('done')
  }

  async function generateAll() {
    setGeneratingAll(true)
    // Mark all clips as "ready" — real generation happens in the pipeline job
    scenes.forEach((s) => updateScene(s.id, { clipStatus: 'done' }))
    if (voiceId) setVoiceStatus('done')
    setGeneratingAll(false)
    toast.success('Configuration validée — la génération se lance à l\'étape suivante')
  }

  const allClipsDone = scenes.every((s) => s.clipStatus === 'done')
  const doneCnt = scenes.filter((s) => s.clipStatus === 'done').length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-brand-border shrink-0">
        <div>
          <h2 className="font-display text-base font-bold text-brand-text">Génération des clips</h2>
          <p className="font-body text-xs text-brand-muted">{doneCnt}/{scenes.length} clips · voix off {voiceStatus === 'done' ? '✓ prête' : 'en attente'}</p>
        </div>
        <button type="button" onClick={generateAll} disabled={generatingAll}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-brand-border text-xs font-body text-brand-muted hover:text-brand-text transition-all disabled:opacity-40">
          {generatingAll ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          Tout générer
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {/* Clips list */}
        {scenes.map((scene, i) => (
          <div key={scene.id} className="rounded-2xl border border-brand-border bg-brand-surface overflow-hidden">
            <div className="flex items-start gap-4 p-4">
              {/* Video thumbnail */}
              <div className={cn('w-28 h-16 rounded-xl flex-shrink-0 relative overflow-hidden bg-gradient-to-br', SCENE_COLORS[i % SCENE_COLORS.length])}>
                {scene.clipStatus === 'generating' ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 size={16} className="text-white/60 animate-spin" />
                  </div>
                ) : scene.clipStatus === 'done' ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                      <Play size={11} className="text-white fill-white" />
                    </div>
                  </div>
                ) : (
                  <button type="button" aria-label="Générer le clip" onClick={() => generateClip(scene.id)}
                    className="absolute inset-0 flex items-center justify-center hover:bg-white/10 transition-colors group">
                    <div className="w-7 h-7 rounded-full border-2 border-white/30 group-hover:border-white/70 flex items-center justify-center transition-all">
                      <Film size={11} className="text-white/50 group-hover:text-white transition-colors" />
                    </div>
                  </button>
                )}
                <span className="absolute bottom-1 left-1 font-mono text-[8px] bg-black/50 text-white/80 px-1.5 rounded">S{i + 1}</span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2">
                  <span className={cn('font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full',
                    scene.clipStatus === 'done' ? 'bg-emerald-50 text-emerald-600' :
                    scene.clipStatus === 'generating' ? 'bg-blue-50 text-blue-500' :
                    'bg-brand-bg text-brand-muted border border-brand-border')}>
                    {scene.clipStatus === 'done' ? '✓ Prêt' : scene.clipStatus === 'generating' ? 'Génération…' : 'En attente'}
                  </span>
                  <div className="flex-1" />
                  <button type="button" onClick={() => setEditingId(editingId === scene.id ? null : scene.id)}
                    className={cn('flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] transition-all', editingId === scene.id ? 'bg-brand-primary-light text-brand-primary' : 'text-brand-muted hover:text-brand-text')}>
                    <Edit3 size={10} /> Prompt
                  </button>
                  <button type="button" onClick={() => generateClip(scene.id)} disabled={scene.clipStatus === 'generating'}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] text-brand-muted hover:text-brand-text transition-all disabled:opacity-40">
                    <RefreshCw size={10} /> Régénérer
                  </button>
                </div>

                {editingId === scene.id ? (
                  <textarea value={scene.animationPrompt} onChange={(e) => updateScene(scene.id, { animationPrompt: e.target.value })}
                    rows={2} placeholder="Prompt animation…"
                    className="w-full bg-brand-bg border border-brand-border rounded-lg px-2 py-1.5 text-xs font-mono text-brand-text focus:outline-none focus:border-brand-primary resize-none" />
                ) : (
                  <p className="text-xs font-mono text-brand-muted leading-relaxed line-clamp-2">{scene.animationPrompt}</p>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Voice-over section */}
        {voiceId && (
          <div className="rounded-2xl border border-brand-border bg-brand-surface overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
                voiceStatus === 'done' ? 'bg-emerald-50' : voiceStatus === 'generating' ? 'bg-blue-50' : 'bg-brand-bg border border-brand-border')}>
                {voiceStatus === 'generating' ? <Loader2 size={16} className="text-blue-500 animate-spin" /> : <Volume2 size={16} className={voiceStatus === 'done' ? 'text-emerald-600' : 'text-brand-muted'} />}
              </div>
              <div className="flex-1">
                <p className="font-display text-sm font-semibold text-brand-text">Voix off</p>
                <p className="text-xs font-body text-brand-muted">
                  {voiceStatus === 'done' ? 'Générée et synchronisée sur les scènes' : voiceStatus === 'generating' ? 'Synthèse en cours…' : 'Sera générée en parallèle des clips'}
                </p>
              </div>
              {voiceStatus !== 'done' && (
                <button type="button" onClick={generateVoice} disabled={voiceStatus === 'generating'}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-brand-border text-xs font-body text-brand-muted hover:text-brand-text transition-all disabled:opacity-40">
                  {voiceStatus === 'generating' ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
                  Générer la voix
                </button>
              )}
            </div>

            {/* Sync timeline */}
            {voiceStatus === 'done' && (
              <div className="px-4 pb-4">
                <div className="bg-brand-bg rounded-xl p-3 border border-brand-border/60">
                  <p className="font-mono text-[9px] uppercase tracking-widest text-brand-muted mb-2">Synchronisation</p>
                  <div className="flex gap-1 h-8 items-center">
                    {scenes.map((_, i) => (
                      <div key={i} className={cn('flex-1 h-full rounded-md flex items-center justify-center text-[8px] font-mono text-white font-bold', ['bg-brand-primary/70','bg-violet-500/70','bg-sky-500/70','bg-emerald-500/70','bg-orange-500/70','bg-pink-500/70'][i % 6])}>
                        S{i + 1}
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="font-mono text-[8px] text-brand-muted">0:00</span>
                    <span className="font-mono text-[8px] text-brand-muted">0:30</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-brand-border bg-brand-surface shrink-0">
        <button type="button" onClick={onBack} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-brand-border text-sm font-body text-brand-muted hover:text-brand-text transition-all">
          <ArrowLeft size={14} /> Retour
        </button>
        <button type="button" onClick={onNext} disabled={!allClipsDone}
          className={cn('flex items-center gap-2 px-5 py-2 rounded-xl font-display font-semibold text-sm transition-all',
            allClipsDone ? 'bg-gray-900 text-white hover:bg-gray-800' : 'bg-brand-bg border border-brand-border text-brand-muted cursor-not-allowed')}>
          Assembler la vidéo <ArrowRight size={13} />
        </button>
      </div>
    </div>
  )
}

// ── Step 5 — Final video ───────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  pending:    'En attente…',
  processing: 'Traitement en cours…',
  storyboard: 'Génération du storyboard…',
  visuals:    'Génération des images…',
  audio:      'Génération de la voix off…',
  assembly:   'Assemblage de la vidéo…',
  done:       'Vidéo prête !',
  error:      'Erreur lors de la génération',
}

function FinalStep({ project, onNew }: { project: ProjectState; onNew: () => void }) {
  const { status, progress, outputUrl, isError, isDone } = useVideoStatus(project.videoId ?? null)

  const videoUrl = outputUrl ?? project.finalVideoUrl

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 max-w-xl mx-auto gap-6">
      {!isDone && !isError ? (
        <div className="w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-brand-primary/10 flex items-center justify-center mx-auto">
            <Loader2 size={28} className="text-brand-primary animate-spin" />
          </div>
          <h2 className="font-display text-xl font-bold text-brand-text">
            {STATUS_LABELS[status] ?? 'Génération en cours…'}
          </h2>
          <p className="font-body text-sm text-brand-muted">
            {project.title || 'Vidéo Faceless'} · {project.scenes.length} scènes · {project.duration}
          </p>
          <div className="h-1.5 bg-brand-bg rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-primary to-purple-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.max(progress, 5)}%` }}
            />
          </div>
          <p className="font-mono text-xs text-brand-muted">{progress}%</p>
        </div>
      ) : isError ? (
        <div className="text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto">
            <X size={26} className="text-red-500" />
          </div>
          <h2 className="font-display text-xl font-bold text-brand-text">Erreur de génération</h2>
          <p className="font-body text-sm text-brand-muted">La génération a échoué. Vérifie les logs du serveur.</p>
          <button type="button" onClick={onNew}
            className="mx-auto flex items-center gap-2 px-5 py-2.5 rounded-xl border border-brand-border text-sm font-body text-brand-muted hover:text-brand-text transition-all">
            <Plus size={14} /> Recommencer
          </button>
        </div>
      ) : (
        <div className="w-full space-y-5 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto">
            <Check size={26} className="text-emerald-600" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold text-brand-text mb-1">Votre vidéo est prête !</h2>
            <p className="font-body text-sm text-brand-muted">{project.title || 'Vidéo Faceless'} · {project.scenes.length} scènes · {project.duration}</p>
          </div>

          <div className={cn('w-full rounded-2xl overflow-hidden aspect-video bg-gradient-to-br', SCENE_COLORS[0], 'flex items-center justify-center')}>
            {videoUrl ? (
              <VideoPlayer url={videoUrl} title={project.title} />
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
                  <Play size={22} className="text-white fill-white" />
                </div>
                <p className="font-mono text-[10px] text-white/60 uppercase tracking-wider">Prévisualisation</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-3">
            <a
              href={videoUrl ?? '#'}
              download={project.title || 'video'}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gray-900 text-white font-display font-semibold text-sm hover:bg-gray-800 transition-all"
            >
              <Download size={15} />
              Télécharger
            </a>
            <button type="button" onClick={onNew}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-brand-border text-sm font-body text-brand-muted hover:text-brand-text hover:border-brand-primary/40 transition-all">
              <Plus size={14} />
              Nouvelle vidéo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Faceless Pipeline ──────────────────────────────────────────────────────────

const DEFAULT_PROJECT: ProjectState = {
  title: '',
  style: null,
  voiceId: '',
  format: '9:16',
  duration: '30s',
  description: '',
  script: '',
  audioFile: null,
  inputType: 'script',
  scenes: [],
  step: 'setup',
}

function FacelessPipeline({ onGenerated }: { onGenerated: (title: string) => void }) {
  const [project, setProject] = useState<ProjectState>(DEFAULT_PROJECT)
  const [loading,  setLoading]  = useState(false)

  function patch(p: Partial<ProjectState>) {
    setProject((prev) => ({ ...prev, ...p }))
  }

  async function goToStoryboard() {
    setLoading(true)
    try {
      const res = await fetch('/api/generate-storyboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche: 'developpement_personnel',
          style: project.style ?? 'cinematique',
          title: project.title || 'Vidéo CLYRO',
          script: project.script || project.description || 'Introduction du sujet. Développement des idées principales. Conclusion et appel à l\'action.',
        }),
      })
      if (!res.ok) throw new Error('Storyboard generation failed')
      const data = await res.json() as {
        scenes: Array<{ index: number; texte_voix: string; description_visuelle: string; duree_estimee: number }>
      }
      const scenes: SceneData[] = data.scenes.map((s) => ({
        id: `scene-${s.index}-${Date.now()}`,
        index: s.index - 1,
        scriptText: s.texte_voix,
        imagePrompt: s.description_visuelle,
        animationPrompt: 'Slow cinematic pan, atmospheric depth, smooth motion',
        imageStatus: 'idle',
        clipStatus: 'idle',
      }))
      patch({ scenes, step: 'storyboard' })
    } catch {
      toast.error('Erreur lors de la génération du storyboard')
      // Fallback to local split
      const scenes = splitScriptToScenes(project.script || project.description || 'Introduction. Développement. Conclusion.')
      patch({ scenes, step: 'storyboard' })
    } finally {
      setLoading(false)
    }
  }

  async function goToImages() {
    patch({ step: 'images' })
  }

  async function goToClips() {
    patch({ step: 'clips' })
  }

  async function goToFinal() {
    setLoading(true)
    try {
      const { video_id } = await startFacelessGeneration({
        title: project.title || 'Vidéo Faceless',
        style: project.style ?? 'cinematique',
        input_type: project.inputType,
        format: project.format,
        duration: project.duration,
        script: project.script || project.description || project.scenes.map((s) => s.scriptText).join(' '),
        voice_id: project.voiceId || undefined,
      })
      patch({ videoId: video_id, step: 'final' })
      onGenerated(project.title || project.script.slice(0, 60) || 'Nouvelle vidéo')
    } catch {
      toast.error('Erreur lors du lancement de la génération')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Loader2 size={32} className="text-brand-primary animate-spin" />
        <p className="font-display text-base font-semibold text-brand-text">Découpage du script en scènes…</p>
        <p className="font-body text-sm text-brand-muted">L'IA analyse ton script et génère les prompts visuels.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <StepIndicator current={project.step} />

      <div className="flex-1 overflow-hidden">
        {project.step === 'setup' && (
          <SetupStep
            project={project}
            onChange={patch}
            onNext={goToStoryboard}
          />
        )}
        {project.step === 'storyboard' && (
          <StoryboardStep
            scenes={project.scenes}
            onScenesChange={(scenes) => patch({ scenes })}
            onBack={() => patch({ step: 'setup' })}
            onNext={goToImages}
          />
        )}
        {project.step === 'images' && (
          <ImagesStep
            scenes={project.scenes}
            style={project.style ?? 'cinematique'}
            onScenesChange={(scenes) => patch({ scenes })}
            onBack={() => patch({ step: 'storyboard' })}
            onNext={goToClips}
          />
        )}
        {project.step === 'clips' && (
          <ClipsStep
            scenes={project.scenes}
            onScenesChange={(scenes) => patch({ scenes })}
            voiceId={project.voiceId}
            onBack={() => patch({ step: 'images' })}
            onNext={goToFinal}
          />
        )}
        {project.step === 'final' && (
          <FinalStep
            project={project}
            onNew={() => setProject(DEFAULT_PROJECT)}
          />
        )}
      </div>
    </div>
  )
}

// ── Sidebar session types ──────────────────────────────────────────────────────

interface VideoSession {
  id: string
  title: string | null
  status: string
  output_url?: string | null
  created_at: string
}

// ── Main Hub ───────────────────────────────────────────────────────────────────

export function FacelessHub({ initialVideos }: { initialVideos: VideoSession[] }) {
  const [sessions, setSessions] = useState<VideoSession[]>(initialVideos)
  const [viewId,   setViewId]   = useState<string | null>(null)

  const viewSession = sessions.find((s) => s.id === viewId) ?? null

  function handleGenerated(title: string) {
    const id = `local-${Date.now()}`
    setSessions((prev) => [
      { id, title, status: 'done', created_at: new Date().toISOString() },
      ...prev,
    ])
    setViewId(id)
  }

  return (
    <div className="flex flex-1 h-full overflow-hidden">

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside className="w-52 bg-brand-surface border-r border-brand-border flex flex-col shrink-0">
        <div className="p-4 border-b border-brand-border flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-brand-text">Faceless Video</h2>
          <Wand2 size={14} className="text-brand-muted" />
        </div>

        <div className="p-3 border-b border-brand-border">
          <button type="button" onClick={() => setViewId(null)}
            className="flex items-center gap-2 w-full bg-brand-bg border border-brand-border rounded-xl px-3 py-2.5 text-sm font-body text-brand-text hover:border-brand-primary/40 hover:bg-blue-50 transition-all">
            <Plus size={15} className="text-brand-primary" />
            Nouvelle vidéo
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
              <Video size={26} className="text-brand-border mb-2" />
              <p className="text-brand-muted font-body text-xs">Aucune vidéo.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {sessions.map((s) => (
                <button key={s.id} type="button" onClick={() => setViewId(s.id)}
                  title={s.title ?? 'Sans titre'}
                  className={cn('w-full text-left px-3 py-2.5 rounded-xl transition-all',
                    viewId === s.id ? 'bg-blue-50' : 'hover:bg-brand-bg')}>
                  <p className="font-body text-xs text-brand-text truncate">{s.title ?? 'Sans titre'}</p>
                  <span className="font-mono text-[9px] text-brand-muted">
                    {new Date(s.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* ── Main panel ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {viewId && viewSession ? (
          <div className="flex flex-col items-center justify-center h-full px-8 max-w-xl mx-auto gap-4">
            <div className="w-full">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-lg font-bold text-brand-text">{viewSession.title ?? 'Vidéo'}</h2>
                <button type="button" onClick={() => setViewId(null)} className="text-xs font-mono text-brand-primary hover:underline">+ Nouvelle vidéo</button>
              </div>
              {viewSession.output_url
                ? <VideoPlayer url={viewSession.output_url} title={viewSession.title ?? undefined} />
                : (
                  <div className={cn('w-full rounded-2xl aspect-video bg-gradient-to-br', SCENE_COLORS[0], 'flex items-center justify-center')}>
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                        <Play size={18} className="text-white fill-white" />
                      </div>
                      <p className="font-mono text-[10px] text-white/60 uppercase tracking-wider">Vidéo générée</p>
                    </div>
                  </div>
                )
              }
              <a href={viewSession.output_url ?? '#'} download={viewSession.title || 'video'}
                className="mt-4 flex items-center justify-center gap-2 w-full px-5 py-2.5 rounded-xl bg-gray-900 text-white font-display font-semibold text-sm hover:bg-gray-800 transition-all">
                <Download size={15} /> Télécharger
              </a>
            </div>
          </div>
        ) : (
          <FacelessPipeline onGenerated={handleGenerated} />
        )}
      </div>
    </div>
  )
}
