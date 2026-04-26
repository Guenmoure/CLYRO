'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  Plus, Video, Mic2, Loader2, ChevronDown, X, Upload, Check, Wand2,
  RefreshCw, RotateCcw, Download, Edit3, ArrowLeft, ArrowRight, Sparkles,
  Settings2, Film, Volume2, Play, AlertTriangle, Trash2, Merge, GripVertical,
} from 'lucide-react'
import { useLanguage } from '@/lib/i18n'
import { cn, checkScriptDuration } from '@/lib/utils'
import { toast } from '@/components/ui/toast'
import { VideoPlayer } from '@/components/ui/video-player'
import { ProgressBar } from '@/components/ui/progress-bar'
import { IconButton } from '@/components/ui/icon-button'
import { startFacelessGeneration, getPublicVoices, updateVideoMetadata, regenerateFacelessScene, regenerateFacelessClip, reassembleFacelessVideo } from '@/lib/api'
import { useVideoStatus } from '@/hooks/use-video-status'
import { useDraftSave } from '@/hooks/use-draft-save'
import type { FacelessStyle, VideoFormat, VideoDuration, AnimationMode } from '@clyro/shared'
import { ContentTemplateGallery } from './ContentTemplateGallery'
import {
  buildTemplateDescription,
  tName,
  FACELESS_STYLES_META,
  type ContentTemplate,
} from '@/lib/faceless-content-templates'

// ── fal.ai concurrency control ─────────────────────────────────────────────
// fal.ai caps accounts at 10 concurrent requests. Each scene fires 2 calls
// (preview + HD) sequentially inside generateImage(), so one running scene
// holds at most 1 fal.ai slot at any moment. With 5 scenes in parallel that's
// a max of 5 concurrent fal.ai calls — safe headroom under the 10-limit for
// incidental traffic (scene-0 retries, user-triggered previews, etc).
const FAL_CONCURRENCY = 5

/**
 * Run an async task over every item of a list with a hard concurrency cap.
 *
 * Unlike `Promise.all(items.map(fn))` (unbounded) or
 * `items.reduce((p, i) => p.then(() => fn(i)))` (strictly sequential), this
 * spins up `concurrency` worker loops that pull items off a shared queue
 * until it's empty, giving exactly N-at-a-time parallelism.
 *
 * Rejected tasks are logged and skipped rather than aborting the batch —
 * the same "one bad scene doesn't kill the rest" guarantee we had before.
 */
async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  task: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return
  const queue = items.slice()
  const worker = async (): Promise<void> => {
    while (queue.length > 0) {
      const item = queue.shift()
      if (item === undefined) return
      try {
        await task(item)
      } catch (err) {
        // Already logged inside the task (generateImage / regenScene handle
        // their own toast + scene.status = 'error'). Swallow so one failing
        // scene doesn't stop the rest of the pool.
        console.warn('[runWithConcurrency] task failed (continuing):', err)
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  )
}

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

function getTemplateCategories(t: (k: string) => string): Array<{ id: TemplateCategory; label: string }> {
  return [
    { id: 'all',        label: t('fh_allStyles') },
    { id: 'cinematic',  label: t('fh_cinematic') },
    { id: 'animation',  label: t('fh_animation') },
    { id: 'handmade',   label: t('fh_handmade') },
    { id: '3d',         label: t('fh_3dvfx') },
  ]
}

function PreviewCinematic({ selected: _s }: { selected: boolean }) {
  return (
    <div className="relative w-full h-full bg-zinc-900 dark:bg-zinc-900 border border-zinc-700/30 overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[14%] bg-black z-10" />
      <div className="absolute bottom-0 left-0 right-0 h-[14%] bg-black z-10" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 z-0">
        <div className="w-10 h-10 rounded-full bg-amber-400/20 border border-amber-400/40 flex items-center justify-center mb-1">
          <div className="w-4 h-4 rounded-full bg-amber-400/60" />
        </div>
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-amber-300/90 text-center px-2">MISE EN SCÈNE</p>
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
    <div className="relative w-full h-full bg-gray-50 dark:bg-zinc-900 overflow-hidden">
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
    <div className="relative w-full h-full bg-stone-50 dark:bg-zinc-900 overflow-hidden">
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
          <p className="font-display font-black text-[11px] text-pink-600 leading-tight">Bonjour!</p>
          <div className="absolute -bottom-1.5 left-4 w-3 h-3 bg-white/90 rotate-45 rounded-sm" />
        </div>
        <p className="font-mono text-[7px] text-white/70 tracking-wider uppercase mt-1">Animation 2D</p>
      </div>
    </div>
  )
}

// 2026 trend labels from FACELESS_STYLES_META, preserving pipeline IDs.
// Short French descriptions focused on the 2026 repositioning; full bilingual
// copy + best-for lists live in FACELESS_STYLES_META.
const STYLE_TEMPLATES: StyleTemplate[] = [
  { id: 'cinematique',     label: FACELESS_STYLES_META['cinematique'].label_fr,     desc: 'Scènes photoréalistes IA, éclairage dramatique, grain filmique',  category: 'cinematic', badge: '2026', preview: PreviewCinematic    },
  { id: 'stock-vo',        label: FACELESS_STYLES_META['stock-vo'].label_fr,        desc: 'Archives documentaires + voix off broadcast',                     category: 'cinematic', preview: PreviewStockVo      },
  { id: 'whiteboard',      label: FACELESS_STYLES_META['whiteboard'].label_fr,      desc: 'Récit sombre : atmosphère noir, ombres, tension horror',          category: 'cinematic', badge: 'Nouveau', preview: PreviewWhiteboard   },
  { id: 'stickman',        label: FACELESS_STYLES_META['stickman'].label_fr,        desc: 'Planches BD manga, bulles de texte, personnages expressifs',      category: 'handmade',  badge: 'Nouveau', preview: PreviewStickman    },
  { id: 'flat-design',     label: FACELESS_STYLES_META['flat-design'].label_fr,     desc: 'Fonds épurés, typo bold, espace négatif — l’esthétique « less »', category: 'animation', badge: '2026', preview: PreviewFlatDesign  },
  { id: '3d-pixar',        label: FACELESS_STYLES_META['3d-pixar'].label_fr,        desc: 'Rendu 3D ludique, ambient occlusion doux, perspective isométrique', category: '3d',      preview: Preview3dPixar     },
  { id: 'motion-graphics', label: FACELESS_STYLES_META['motion-graphics'].label_fr, desc: 'Formes animées, typographie cinétique, data-viz corporate',      category: '3d',        preview: PreviewMotionGraphics },
  { id: 'animation-2d',    label: FACELESS_STYLES_META['animation-2d'].label_fr,    desc: 'Illustrations chaleureuses aquarelle, personnages amicaux, cosy', category: 'animation', badge: 'Nouveau', preview: PreviewAnimation2d  },
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
  qualityHint?: 'draft' | 'hd'   // draft = schnell preview, hd = flux/dev full quality
  streamLog?: string              // live log message from fal.ai SSE stream
  imageHistory?: string[]         // previous imageUrls, max 3
  clipUrl?: string
  clipStatus: 'idle' | 'generating' | 'done' | 'error'
  duree_estimee?: number          // estimated duration in seconds
  audioDuration?: number          // actual audio duration in seconds from ElevenLabs
  overlayText?: string            // optional caption burned on the clip via ffmpeg drawtext
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
  masterSeed?: number    // deterministic seed for visual consistency across scenes
  styleReference?: string // URL of first HD image for style consistency injection
  contentTemplateId?: string  // selected channel-style template (e.g. tmpl_easyway_actually)
  animationMode?: AnimationMode // 'storyboard' = bypass Kling (Ken Burns), 'fast' | 'pro' = Kling variants
}

// ── Mock helpers ───────────────────────────────────────────────────────────────

function splitScriptToScenes(script: string): SceneData[] {
  const sentences = script
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15)
  // Scene count mirrors the server-side logic: ~22 words per scene, min 3, max 40
  const wordCount = script.trim().split(/\s+/).filter(Boolean).length
  const count = Math.max(3, Math.min(40, Math.ceil(wordCount / 22)))
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

// ── Example script catalogue ────────────────────────────────────────────────────

const EXAMPLE_SCRIPTS: Array<{ label: string; style: FacelessStyle; duration: VideoDuration; script: string; description: string }> = [
  {
    label: 'fh_scienceSpace',
    style: 'cinematique',
    duration: '30s',
    description: 'Educational video about black holes, scientific narration, epic space animations.',
    script: `Les trous noirs sont les objets les plus mystérieux de l'univers. Là où la gravité devient si intense que même la lumière ne peut s'échapper. Ils se forment quand une étoile géante s'effondre sur elle-même à la fin de sa vie. À l'horizon des événements, le temps lui-même se fige. Les scientifiques estiment qu'au cœur de chaque galaxie se trouve un trou noir supermassif. Celui au centre de notre Voie Lactée fait 4 millions de fois la masse du Soleil. En 2019, l'humanité a capturé pour la première fois une image réelle d'un trou noir — à 55 millions d'années-lumière. Une fenêtre ouverte sur les confins de la physique moderne.`,
  },
  {
    label: 'fh_motivationMindset',
    style: 'motion-graphics',
    duration: '30s',
    description: 'Motivational content with a strong message about discipline and success.',
    script: `La réussite ne vient pas du talent. Elle vient de la constance. Chaque matin où tu te lèves avant les autres, tu creuses l'écart. Chaque fois que tu choisis le travail plutôt que le confort, tu construis ton avenir. Les gens qui réussissent ne sont pas plus intelligents. Ils sont plus réguliers. Ils font ce que les autres évitent. La discipline, c'est choisir entre ce que tu veux maintenant et ce que tu veux le plus. Commence aujourd'hui. Pas demain. Maintenant.`,
  },
  {
    label: 'fh_productTutorial',
    style: 'flat-design',
    duration: '15s',
    description: 'Clear and concise SaaS product presentation, modern explanatory style.',
    script: `Vous perdez des heures chaque semaine à gérer vos tâches manuellement. Notre solution automatise tout en 3 clics. Connectez vos outils existants en quelques secondes. Visualisez l'avancement de votre équipe en temps réel. Recevez des rapports automatiques chaque vendredi. Plus de 10 000 équipes ont déjà gagné 5 heures par semaine. Essayez gratuitement pendant 14 jours.`,
  },
]

const FORMATS: Array<{ id: VideoFormat; label: string; desc: string }> = [
  { id: '9:16', label: '9:16', desc: 'TikTok / Reels' },
  { id: '1:1',  label: '1:1',  desc: 'Instagram'      },
  { id: '16:9', label: '16:9', desc: 'YouTube'         },
]

const DURATIONS: Array<{ id: VideoDuration; label: string }> = [
  { id: 'auto', label: 'Auto (script)' },
  { id: '15s',  label: '15s'  },
  { id: '30s',  label: '30s'  },
  { id: '60s',  label: '60s'  },
  { id: '120s', label: '2 min' },
  { id: '180s', label: '3 min' },
  { id: '300s', label: '5 min' },
]

interface VoiceItem { id: string; name: string; gender?: string; accent?: string; previewUrl?: string }

// ── Dialogue detection ─────────────────────────────────────────────────────────

function detectDialogueInScript(script: string): { hasDialogue: boolean; speakers: Set<string> } {
  const lines = script.split('\n')
  const speakers = new Set<string>()

  const patterns = [
    /^—\s*([A-ZÀ-Ü][a-zà-ü]+)/,           // — Alice
    /^([A-ZÀ-Ü][a-zà-ü]+)\s*:/,           // Alice:
    /^–\s*([A-ZÀ-Ü][a-zà-ü]+)/,           // – Alice
  ]

  for (const line of lines) {
    const trimmed = line.trim()
    for (const pattern of patterns) {
      const match = trimmed.match(pattern)
      if (match) {
        speakers.add(match[1])
      }
    }
  }

  return {
    hasDialogue: speakers.size > 1,
    speakers,
  }
}

// ── Step indicator ─────────────────────────────────────────────────────────────

function getPipelineSteps(t: (k: string) => string): Array<{ id: PipelineStep; label: string }> {
  return [
    { id: 'setup',      label: t('fh_pipelineScript') },
    { id: 'storyboard', label: t('fh_pipelineScenes') },
    { id: 'images',     label: t('fh_pipelineImages') },
    { id: 'clips',      label: t('fh_pipelineClips')  },
    { id: 'final',      label: t('fh_pipelineVideo')  },
  ]
}

function StepIndicator({ current, savedState }: { current: PipelineStep; savedState?: 'saving' | 'saved' | null }) {
  const { t } = useLanguage()
  const PIPELINE_STEPS = getPipelineSteps(t)
  const currentIdx = PIPELINE_STEPS.findIndex((s) => s.id === current)
  const progressPct = PIPELINE_STEPS.length > 1
    ? Math.round((currentIdx / (PIPELINE_STEPS.length - 1)) * 100)
    : 0
  return (
    <div
      className="glass glass-border-b relative flex items-center gap-1 px-6 py-3 shrink-0 z-20 rounded-b-2xl shadow-[0_4px_16px_rgba(0,0,0,0.12)]"
      role="progressbar"
      aria-valuenow={progressPct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Étape ${currentIdx + 1} sur ${PIPELINE_STEPS.length} : ${PIPELINE_STEPS[currentIdx]?.label ?? ''}`}
    >
      {/* Barre de progression linéaire sous les steps */}
      <div
        className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-blue-500 via-violet-500 to-cyan-400 transition-all duration-500 ease-out"
        style={{ width: `${progressPct}%` }}
        aria-hidden="true"
      />
      {PIPELINE_STEPS.map((step, i) => {
        const done   = i < currentIdx
        const active = i === currentIdx
        return (
          <div key={step.id} className="flex items-center gap-1">
            <div className={cn(
              'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-body font-medium transition-all',
              active ? 'bg-blue-500 text-white shadow-sm' :
              done   ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' :
                       'text-[--text-muted]'
            )}>
              {done
                ? <Check size={10} />
                : <span className="font-mono text-[11px] opacity-60">{i + 1}</span>
              }
              <span>{step.label}</span>
            </div>
            {i < PIPELINE_STEPS.length - 1 && (
              <div className={cn('w-5 h-px', done ? 'bg-emerald-300' : 'bg-border')} />
            )}
          </div>
        )
      })}
      {/* Auto-save indicator */}
      {savedState && (
        <div className={cn(
          'ml-auto flex items-center gap-1 text-[11px] font-mono transition-all',
          savedState === 'saving' ? 'text-[--text-muted]' : 'text-emerald-600'
        )}>
          {savedState === 'saving'
            ? <><Loader2 size={10} className="animate-spin" /> Sauvegarde…</>
            : <><Check size={10} /> Sauvegardé</>
          }
        </div>
      )}
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
    <div className="absolute left-0 top-full mt-2 z-50 w-[480px] bg-card border border-border rounded-2xl shadow-xl p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <p className="font-display text-sm font-semibold text-foreground">Style visuel</p>
        <button type="button" onClick={onClose} aria-label="Fermer" className="text-[--text-muted] hover:text-foreground transition-colors"><X size={14} /></button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {STYLE_TEMPLATES.map((s) => {
          const Preview = s.preview
          return (
            <button key={s.id} type="button" onClick={() => { onChange(s.id); onClose() }}
              className={cn('relative rounded-xl overflow-hidden transition-all',
                value === s.id ? 'ring-2 ring-blue-500 ring-offset-1' : 'hover:ring-1 hover:ring-border')}>
              <div className="h-16 w-full relative"><Preview selected={value === s.id} /></div>
              <div className="p-2 bg-muted">
                <p className="font-display font-semibold text-[11px] text-foreground truncate">{s.label}</p>
              </div>
              {s.badge && <span className="absolute top-1 right-1 font-mono text-[8px] uppercase tracking-wider bg-blue-500 text-white px-1 py-0.5 rounded-full">{s.badge}</span>}
              {value === s.id && <div className="absolute top-1 left-1 w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center"><Check size={8} className="text-white" /></div>}
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
  const { t } = useLanguage()
  const [playingId, setPlayingId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  function playPreview(e: React.MouseEvent, voice: VoiceItem) {
    e.stopPropagation()
    if (!voice.previewUrl) return
    if (playingId === voice.id) {
      audioRef.current?.pause()
      setPlayingId(null)
      return
    }
    if (audioRef.current) audioRef.current.pause()
    const audio = new Audio(voice.previewUrl)
    audioRef.current = audio
    audio.play().catch(() => null)
    setPlayingId(voice.id)
    audio.onended = () => setPlayingId(null)
  }

  return (
    <div className="absolute left-0 top-full mt-2 z-50 w-72 bg-card border border-border rounded-2xl shadow-xl p-3 animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <p className="font-display text-sm font-semibold text-foreground">Voix off</p>
        <button type="button" onClick={onClose} aria-label="Fermer" className="text-[--text-muted] hover:text-foreground transition-colors"><X size={14} /></button>
      </div>
      {voices.length === 0 && (
        <p className="text-xs text-[--text-muted] text-center py-3">Chargement des voix…</p>
      )}
      <div className="space-y-1 max-h-64 overflow-y-auto">
        <button type="button" onClick={() => { onChange(''); onClose() }}
          className={cn('w-full text-left px-3 py-2 rounded-xl text-sm font-body transition-colors',
            !value ? 'bg-blue-500/10 text-blue-500' : 'hover:bg-card text-[--text-muted]')}>
          Aucune voix
        </button>
        {voices.map((v) => (
          <div key={v.id} className={cn('flex items-center gap-2 rounded-xl transition-colors', value === v.id ? 'bg-blue-500/10' : 'hover:bg-card')}>
            <button type="button" onClick={() => { onChange(v.id); onClose() }} className="flex-1 text-left px-3 py-2">
              <p className={cn('text-sm font-body font-medium', value === v.id ? 'text-blue-500' : 'text-foreground')}>{v.name}</p>
              {(v.gender || v.accent) && <p className="text-[11px] text-[--text-muted]">{[v.gender, v.accent].filter(Boolean).join(' · ')}</p>}
            </button>
            {v.previewUrl && (
              <button type="button" onClick={(e) => playPreview(e, v)} aria-label={t('fh_previewVoice')}
                className={cn('w-7 h-7 flex-shrink-0 rounded-lg flex items-center justify-center mr-2 transition-all',
                  playingId === v.id ? 'bg-blue-500 text-white' : 'bg-card border border-border text-[--text-muted] hover:text-blue-500')}>
                {playingId === v.id
                  ? <div className="w-2.5 h-2.5 flex gap-0.5 items-center"><div className="w-0.5 h-2.5 bg-white rounded" /><div className="w-0.5 h-2.5 bg-white rounded" /></div>
                  : <Play size={9} className="fill-current translate-x-px" />}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Template gallery ───────────────────────────────────────────────────────────

function TemplateGallery({ selected, onSelect }: { selected: FacelessStyle | null; onSelect: (id: FacelessStyle) => void }) {
  const { t } = useLanguage()
  const [activeCategory, setActiveCategory] = useState<TemplateCategory>('all')
  const filtered = activeCategory === 'all' ? STYLE_TEMPLATES : STYLE_TEMPLATES.filter((t) => t.category === activeCategory)

  return (
    <div className="border-t border-border px-6 py-8 bg-muted/50">
      <div className="max-w-2xl mx-auto">
        <p className="font-display text-base font-semibold text-foreground mb-4">Styles disponibles</p>
        <div className="flex flex-wrap gap-2 mb-5">
          {getTemplateCategories(t).map((cat) => (
            <button key={cat.id} type="button" onClick={() => setActiveCategory(cat.id)}
              className={cn('px-3.5 py-1.5 rounded-full text-xs font-body font-medium border transition-all',
                activeCategory === cat.id
                  ? 'bg-blue-500/10 border-blue-500 text-blue-500'
                  : 'bg-muted border-border text-[--text-muted] hover:border-blue-500/40 hover:text-foreground')}>
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
                  isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : 'hover:scale-[1.02] hover:shadow-card')}>
                <div className="h-24 w-full relative"><Preview selected={isSelected} /></div>
                <div className="p-2.5 bg-muted border-t border-border/50">
                  <p className="font-display font-bold text-[11px] text-foreground">{t.label}</p>
                  <p className="font-body text-[11px] text-[--text-muted] mt-0.5 leading-tight">{t.desc}</p>
                </div>
                {t.badge && <span className="absolute top-2 right-2 font-mono text-[8px] uppercase tracking-wider bg-blue-500 text-white px-1.5 py-0.5 rounded-full">{t.badge}</span>}
                {isSelected && <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center shadow"><Check size={9} className="text-white" /></div>}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Step 1 — Setup ─────────────────────────────────────────────────────────────

function SetupStep({ project, onChange, onNext, loading = false }: {
  project: ProjectState
  onChange: (patch: Partial<ProjectState>) => void
  onNext: () => void
  loading?: boolean
}) {
  const { t } = useLanguage()
  const [voices, setVoices] = useState<VoiceItem[]>([])
  const [showStylePicker, setShowStylePicker] = useState(false)
  const [showVoicePicker, setShowVoicePicker] = useState(false)
  const styleRef = useRef<HTMLDivElement>(null)
  const voiceRef = useRef<HTMLDivElement>(null)
  const fileRef  = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getPublicVoices().then(({ voices: v }) => {
      setVoices(v.map((voice) => ({
        id: voice.id,
        name: voice.name,
        gender: voice.gender,
        accent: voice.accent,
        previewUrl: voice.previewUrl ?? undefined,
      })))
    }).catch(() => null)
  }, [])

  // Récupère le script pré-rempli depuis la landing page (hero textarea)
  useEffect(() => {
    const prefilled = localStorage.getItem('clyro_prefilled_script')
    if (prefilled) {
      onChange({ script: prefilled })
      localStorage.removeItem('clyro_prefilled_script')
      toast.success(t('fh_scriptPreloaded'))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    project.inputType === 'script' ? (project.script ?? '').trim().length >= 20 : !!project.audioFile
  )

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex flex-col items-center justify-start px-6 pt-12 pb-8">
        <div className="w-full max-w-2xl space-y-6">

          {/* Headline */}
          <div className="text-center space-y-2">
            <h1 className="font-display text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
              Create your Faceless video
            </h1>
            <p className="font-body text-sm md:text-base text-[--text-secondary] max-w-xl mx-auto">
              {t('fh_subtitle')}
            </p>
          </div>

          {/* Description */}
          <div className="rounded-2xl border border-border bg-muted overflow-hidden">
            <div className="px-4 pt-4 pb-2">
              <p className="font-mono text-[11px] uppercase tracking-widest text-[--text-secondary] font-semibold mb-2">{t('fh_contentDesc')}</p>
              <textarea
                value={project.description}
                onChange={(e) => onChange({ description: e.target.value })}
                placeholder={t('fh_descPlaceholder')}
                rows={3}
                className="w-full bg-transparent text-foreground font-body text-sm placeholder:text-[--text-secondary] focus:outline-none resize-none"
              />
            </div>
          </div>

          {/* Script / Audio */}
          <div className="rounded-2xl border border-border bg-muted overflow-hidden">
            {/* Tab bar */}
            <div className="flex items-center gap-1 px-4 pt-3 mb-2">
              <p className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted] flex-1">
                {project.inputType === 'script' ? t('fh_scriptLabel') : t('fh_audioLabel')}
              </p>
              <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-0.5">
                <button type="button" onClick={() => onChange({ inputType: 'script' })}
                  className={cn('px-3 py-1 rounded-lg text-xs font-mono transition-all', project.inputType === 'script' ? 'bg-muted shadow-sm text-foreground' : 'text-[--text-muted] hover:text-foreground')}>
                  Script
                </button>
                <button type="button" onClick={() => onChange({ inputType: 'audio' })}
                  className={cn('px-3 py-1 rounded-lg text-xs font-mono transition-all', project.inputType === 'audio' ? 'bg-muted shadow-sm text-foreground' : 'text-[--text-muted] hover:text-foreground')}>
                  Audio
                </button>
              </div>
            </div>

            {project.inputType === 'script' ? (
              <textarea
                value={project.script}
                onChange={(e) => onChange({ script: e.target.value })}
                onKeyDown={(e) => {
                  // Cmd/Ctrl + Enter → go to next step (quick flow for power users)
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canNext && !loading) {
                    e.preventDefault()
                    onNext()
                  }
                }}
                placeholder={t('fh_scriptPlaceholder')}
                maxLength={8000}
                rows={6}
                className="w-full bg-transparent px-4 pb-3 text-foreground font-body text-sm placeholder:text-[--text-secondary] focus:outline-none resize-none"
              />
            ) : (
              <div className="px-4 pb-4">
                <label htmlFor="faceless-audio"
                  className={cn('flex flex-col items-center justify-center h-28 rounded-xl border-2 border-dashed cursor-pointer transition-all',
                    project.audioFile ? 'border-blue-500 bg-blue-500/10' : 'border-border hover:border-blue-500/50')}>
                  <Upload size={18} className={cn('mb-2', project.audioFile ? 'text-blue-500' : 'text-[--text-muted]')} />
                  <p className="font-display text-sm font-semibold text-foreground">{project.audioFile ? project.audioFile.name : t('fh_importAudio')}</p>
                  <p className="text-xs text-[--text-muted] mt-0.5">MP3, WAV, M4A — max 50 MB</p>
                  <input ref={fileRef} id="faceless-audio" type="file" accept="audio/*" className="hidden"
                    onChange={(e) => onChange({ audioFile: e.target.files?.[0] ?? null })} />
                </label>
              </div>
            )}

            {project.inputType === 'script' && (
              <>
                <div className="px-4 pb-3 flex items-center justify-between gap-2">
                  {(() => {
                    const s = project.script ?? ''
                    const words = s.trim() ? s.trim().split(/\s+/).length : 0
                    const estSec = Math.round(words / 2.5) // ~150 wpm voiceover
                    return (
                      <span className={cn('font-mono text-[11px]', s.length < 20 ? 'text-amber-500' : 'text-[--text-muted]')}>
                        {words} {t('fh_words')} · ~{estSec}s {t('fh_estimated')}
                        {s.length < 20 && ` · ${20 - s.length} ${t('fh_moreChars')}`}
                      </span>
                    )
                  })()}
                  {!(project.script ?? '').trim() && (
                    <div className="flex items-center gap-1">
                      {EXAMPLE_SCRIPTS.map((ex) => (
                        <button
                          key={ex.label}
                          type="button"
                          onClick={() => onChange({ script: ex.script, description: ex.description, style: ex.style, duration: ex.duration })}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg border border-border text-[11px] font-mono text-[--text-muted] hover:border-blue-500/40 hover:text-blue-500 transition-all"
                        >
                          <Sparkles size={9} /> {t(ex.label)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Dialogue detection banner */}
                {(() => {
                  const dialogue = detectDialogueInScript(project.script)
                  return dialogue.hasDialogue ? (
                    <div className="px-4 pb-2">
                      <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2.5 flex items-start gap-2">
                        <Volume2 size={14} className="text-blue-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="font-body text-xs font-medium text-blue-900">{t('fh_dialogueDetected')}</p>
                          <p className="font-body text-[11px] text-blue-700 mt-0.5">
                            {dialogue.speakers.size} personnages trouvés ({Array.from(dialogue.speakers).join(', ')}). Les voix alterneront automatiquement.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null
                })()}
              </>
            )}
          </div>

          {/* Style + Voice row */}
          <div className="flex flex-wrap gap-2 items-center">
            {/* Style */}
            <div ref={styleRef} className="relative">
              <button type="button" onClick={() => { setShowStylePicker((v) => !v); setShowVoicePicker(false) }}
                className={cn('flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-body transition-all',
                  project.style ? 'bg-blue-500/10 border-blue-500 text-blue-500' : 'bg-card border-border text-[--text-muted] hover:border-blue-500/40')}>
                <span className="font-medium">{selectedStyle?.label ?? t('fh_visualStyle')}</span>
                <ChevronDown size={13} className={cn('transition-transform', showStylePicker && 'rotate-180')} />
              </button>
              {showStylePicker && <StylePickerDropdown value={project.style} onChange={(s) => onChange({ style: s })} onClose={() => setShowStylePicker(false)} />}
            </div>

            {/* Voice */}
            <div ref={voiceRef} className="relative">
              <button type="button" onClick={() => { setShowVoicePicker((v) => !v); setShowStylePicker(false) }}
                className={cn('flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-body transition-all',
                  project.voiceId ? 'bg-blue-500/10 border-blue-500 text-blue-500' : 'bg-card border-border text-[--text-muted] hover:border-blue-500/40')}>
                <Mic2 size={14} />
                <span className="font-medium">{selectedVoice?.name ?? t('fh_voiceover')}</span>
                <ChevronDown size={13} className={cn('transition-transform', showVoicePicker && 'rotate-180')} />
              </button>
              {showVoicePicker && <VoicePickerDropdown value={project.voiceId} voices={voices} onChange={(id) => onChange({ voiceId: id })} onClose={() => setShowVoicePicker(false)} />}
            </div>

            {/* Format */}
            <div className="flex items-center gap-1 rounded-xl border border-border bg-card px-1.5 py-1">
              {FORMATS.map((f) => (
                <button key={f.id} type="button" title={f.desc} onClick={() => onChange({ format: f.id })}
                  className={cn('px-2.5 py-1 rounded-lg text-xs font-display font-semibold transition-all',
                    project.format === f.id ? 'bg-blue-500/10 border border-blue-500 text-blue-500' : 'text-[--text-muted] hover:text-foreground')}>
                  {f.label}
                </button>
              ))}
            </div>

            {/* Title */}
            <input type="text" value={project.title} onChange={(e) => onChange({ title: e.target.value })}
              placeholder={t('fh_titlePlaceholder')}
              className="ml-auto hidden sm:block flex-1 max-w-xs bg-muted border border-border rounded-xl px-3 py-2 text-foreground font-body text-sm placeholder:text-[--text-muted] focus:outline-none focus:border-blue-500 transition-colors" />
          </div>

          {/* Generate row — separate from dropdowns to avoid click interception (P0 fix) */}
          <div className="relative z-10 flex items-center justify-between gap-3 pt-1">
            {/* Inline hint when button is disabled — user knows why */}
            <p
              className={cn(
                'font-body text-xs transition-opacity duration-200',
                canNext || loading ? 'opacity-0' : 'text-[--text-secondary] opacity-100',
              )}
              aria-live="polite"
            >
              {!project.style ? '→ Select a visual style below' :
                project.inputType === 'script'
                  ? '→ Paste a script (min. 20 characters)'
                  : '→ Importe un fichier audio'}
            </p>
            <button type="button" onClick={onNext} disabled={!canNext || loading}
              aria-disabled={!canNext || loading}
              className={cn('flex items-center gap-2 px-5 py-2.5 rounded-xl font-display font-semibold text-sm transition-all shrink-0',
                canNext && !loading ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-sm hover:shadow-md' : 'bg-card border border-border text-[--text-muted] cursor-not-allowed')}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              Generate storyboard
              {!loading && <ArrowRight size={13} />}
            </button>
          </div>

        </div>
      </div>

      {/* Content templates — channel-style frameworks (EasyWay, Aura Vasta…) */}
      <ContentTemplateGallery
        selectedTemplateId={project.contentTemplateId ?? null}
        onSelect={(template: ContentTemplate) => {
          const templateName = tName(template, 'fr')
          onChange({
            contentTemplateId: template.id,
            description: buildTemplateDescription(template, 'fr'),
            style: template.fal_style as FacelessStyle,
            // Pre-fill title only if user hasn't typed one yet
            title: project.title.trim() ? project.title : templateName,
          })
          // Smooth scroll back to the top so the user sees the auto-filled fields
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }
          toast.success(`Template "${templateName}" appliqué — édite la description et écris ton script`)
        }}
      />
    </div>
  )
}

// ── Step 2 — Storyboard ────────────────────────────────────────────────────────

// Helper: calculate duration from script text (words / 2.5 = seconds at 150wpm)
function calculateSceneDuration(scriptText: string): number {
  const wordCount = scriptText.trim().split(/\s+/).length
  return Math.round(wordCount / 2.5 * 10) / 10 // round to 1 decimal place
}

function StoryboardStep({ scenes, onScenesChange, onBack, onNext }: {
  scenes: SceneData[]
  onScenesChange: (scenes: SceneData[] | ((prev: SceneData[]) => SceneData[])) => void
  onBack: () => void
  onNext: () => void
}) {
  const { t } = useLanguage()
  const [generating,    setGenerating]    = useState(false)
  const [editingId,     setEditingId]     = useState<string | null>(null)
  const [dragIndex,     setDragIndex]     = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  function updateScene(id: string, patch: Partial<SceneData>) {
    onScenesChange((prev) => prev.map((s) => s.id === id ? { ...s, ...patch } : s))
  }

  function deleteScene(id: string) {
    onScenesChange((prev) => prev.filter((s) => s.id !== id).map((s, i) => ({ ...s, index: i })))
    if (editingId === id) setEditingId(null)
    toast.success(t('fh_sceneDeleted'))
  }

  function mergeWithNext(id: string) {
    const idx = scenes.findIndex((s) => s.id === id)
    if (idx < 0 || idx >= scenes.length - 1) return
    const a = scenes[idx], b = scenes[idx + 1]
    const merged: SceneData = {
      ...a,
      scriptText: [a.scriptText, b.scriptText].filter(Boolean).join(' '),
      imagePrompt:     a.imagePrompt     || b.imagePrompt,
      animationPrompt: a.animationPrompt || b.animationPrompt,
    }
    onScenesChange(
      [...scenes.slice(0, idx), merged, ...scenes.slice(idx + 2)].map((s, i) => ({ ...s, index: i }))
    )
    toast.success(t('fh_scenesMerged'))
  }

  function handleDragStart(i: number) { setDragIndex(i) }
  function handleDragOver(e: React.DragEvent, i: number) { e.preventDefault(); setDragOverIndex(i) }
  function handleDragEnd() { setDragIndex(null); setDragOverIndex(null) }
  function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) { handleDragEnd(); return }
    const next = [...scenes]
    const [moved] = next.splice(dragIndex, 1)
    next.splice(targetIndex, 0, moved)
    onScenesChange(next.map((s, i) => ({ ...s, index: i })))
    handleDragEnd()
  }

  async function regenScene(id: string) {
    const scene = scenes.find((s) => s.id === id)
    if (!scene) return
    updateScene(id, { imageStatus: 'generating' })
    try {
      const res = await fetch('/api/regen-scene-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptText: scene.scriptText, style: 'cinematique' }),
      })
      if (!res.ok) throw new Error('Prompt regen failed')
      const data = await res.json() as { imagePrompt: string; animationPrompt: string }
      updateScene(id, { imageStatus: 'idle', imagePrompt: data.imagePrompt, animationPrompt: data.animationPrompt })
      toast.success(t('fh_promptsRegenerated'))
    } catch {
      updateScene(id, { imageStatus: 'idle' })
      toast.error(t('fh_promptsRegenError'))
    }
  }

  async function regenAll() {
    setGenerating(true)
    // Same concurrency cap as generateRemaining — regenScene calls Claude
    // for prompt regen (not fal.ai), so the 10-concurrency limit doesn't
    // apply here directly, but Anthropic also rate-limits and 40 parallel
    // Claude calls would hit that ceiling too.
    await runWithConcurrency(scenes, FAL_CONCURRENCY, (s) => regenScene(s.id))
    setGenerating(false)
    toast.success(t('fh_scenesRegenerated'))
  }

  function addScene() {
    const newScene: SceneData = {
      id: `scene-${Date.now()}`,
      index: scenes.length,
      scriptText: '',
      imagePrompt: '',
      animationPrompt: '',
      imageStatus: 'idle',
      clipStatus: 'idle',
    }
    onScenesChange((prev) => [...prev, newScene])
    toast.success(t('fh_sceneAdded'))
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div>
          <h2 className="font-display text-base font-bold text-foreground">Scènes de ta vidéo</h2>
          <p className="font-body text-xs text-[--text-muted]">{scenes.length} scènes générées — modifie le script et les prompts avant de générer les images</p>
        </div>
        <button type="button" onClick={regenAll} disabled={generating}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs font-body text-[--text-muted] hover:text-foreground hover:border-blue-500/40 transition-all">
          {generating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          Tout régénérer
        </button>
      </div>

      {/* Scenes list */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {scenes.map((scene, i) => (
          <div
            key={scene.id}
            draggable
            onDragStart={() => handleDragStart(i)}
            onDragOver={(e) => handleDragOver(e, i)}
            onDrop={() => handleDrop(i)}
            onDragEnd={handleDragEnd}
            className={cn(
              'rounded-2xl border bg-muted overflow-hidden transition-all',
              dragOverIndex === i && dragIndex !== i ? 'border-blue-500/60 ring-2 ring-blue-500/20' : 'border-border',
              dragIndex === i ? 'opacity-50' : '',
            )}
          >
            {/* Scene header */}
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/60 bg-card/40">
              {/* Drag handle */}
              <GripVertical size={14} className="text-[--text-muted]/40 cursor-grab active:cursor-grabbing shrink-0" />
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[11px] font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full">
                  Scène {i + 1}
                </span>
                <span className="font-mono text-[11px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                  ~{calculateSceneDuration(scene.scriptText)}s
                </span>
              </div>
              <div className="flex-1" />
              <button type="button" onClick={() => setEditingId(editingId === scene.id ? null : scene.id)}
                className={cn('flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all', editingId === scene.id ? 'bg-blue-500/10 text-blue-500' : 'text-[--text-muted] hover:text-foreground')}>
                <Edit3 size={11} />
                {editingId === scene.id ? t('fh_editClose') : t('fh_editOpen')}
              </button>
              <button type="button" onClick={() => regenScene(scene.id)}
                disabled={scene.imageStatus === 'generating'}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-[--text-muted] hover:text-foreground transition-all">
                {scene.imageStatus === 'generating' ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                Régénérer
              </button>
              {/* Merge with next */}
              {i < scenes.length - 1 && (
                <IconButton
                  variant="ghost"
                  size="sm"
                  aria-label={t('fh_mergeScene')}
                  onClick={() => mergeWithNext(scene.id)}
                  className="hover:text-amber-600"
                >
                  <Merge />
                </IconButton>
              )}
              {/* Delete */}
              {scenes.length > 1 && (
                <IconButton
                  variant="danger"
                  size="sm"
                  aria-label={t('fh_deleteScene')}
                  onClick={() => deleteScene(scene.id)}
                >
                  <Trash2 />
                </IconButton>
              )}
            </div>

            <div className="p-4 space-y-3">
              {/* Script text */}
              <div>
                <p className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted] mb-1.5">Script de la scène</p>
                {editingId === scene.id ? (
                  <textarea value={scene.scriptText} onChange={(e) => updateScene(scene.id, { scriptText: e.target.value })}
                    rows={3} placeholder={t('fh_scriptTextPlaceholder')}
                    className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm font-body text-foreground focus:outline-none focus:border-blue-500 transition-colors resize-none" />
                ) : (
                  <p className="text-sm font-body text-foreground leading-relaxed">{scene.scriptText}</p>
                )}
              </div>

              {/* Prompts */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-card rounded-xl p-3 border border-border/60">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div className="w-3 h-3 rounded bg-sky-200 flex items-center justify-center">
                      <span className="text-[8px]">🖼</span>
                    </div>
                    <p className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted]">Prompt image</p>
                  </div>
                  {editingId === scene.id ? (
                    <textarea value={scene.imagePrompt} onChange={(e) => updateScene(scene.id, { imagePrompt: e.target.value })}
                      rows={3} placeholder={t('fh_imagePromptPlaceholder')}
                      className="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:border-blue-500 transition-colors resize-none" />
                  ) : (
                    <p className="text-xs font-mono text-[--text-muted] leading-relaxed line-clamp-3">{scene.imagePrompt}</p>
                  )}
                </div>
                <div className="bg-card rounded-xl p-3 border border-border/60">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div className="w-3 h-3 rounded bg-violet-200 flex items-center justify-center">
                      <span className="text-[8px]">🎬</span>
                    </div>
                    <p className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted]">Prompt animation</p>
                  </div>
                  {editingId === scene.id ? (
                    <textarea value={scene.animationPrompt} onChange={(e) => updateScene(scene.id, { animationPrompt: e.target.value })}
                      rows={3} placeholder={t('fh_animPromptPlaceholder')}
                      className="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:border-blue-500 transition-colors resize-none" />
                  ) : (
                    <p className="text-xs font-mono text-[--text-muted] leading-relaxed line-clamp-3">{scene.animationPrompt}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Add scene button */}
        <button type="button" onClick={addScene}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl border border-dashed border-border/60 text-xs font-body text-[--text-muted] hover:text-foreground hover:border-blue-500/40 transition-all hover:bg-blue-500/10/20">
          <Plus size={14} />
          Ajouter une scène
        </button>
      </div>

      {/* Footer navigation */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted shrink-0">
        <button type="button" onClick={onBack} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-sm font-body text-[--text-muted] hover:text-foreground transition-all">
          <ArrowLeft size={14} /> Retour
        </button>
        <button type="button" onClick={onNext} className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gray-900 text-white font-display font-semibold text-sm hover:bg-gray-800 transition-all">
          Generate images <ArrowRight size={13} />
        </button>
      </div>
    </div>
  )
}

// ── Comparison Slider ──────────────────────────────────────────────────────────

function ComparisonSlider({ before, after, onClose }: { before: string; after: string; onClose: () => void }) {
  const [pct, setPct] = useState(50)
  const ref = useRef<HTMLDivElement>(null)

  function onMove(clientX: number) {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    setPct(Math.max(5, Math.min(95, ((clientX - rect.left) / rect.width) * 100)))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-8"
      onClick={onClose}>
      <div className="relative max-w-3xl w-full rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <div ref={ref}
          className="relative aspect-video cursor-ew-resize select-none"
          onMouseMove={(e) => onMove(e.clientX)}
          onTouchMove={(e) => onMove(e.touches[0].clientX)}>
          {/* Before */}
          <img src={before} alt="Version précédente" className="absolute inset-0 w-full h-full object-cover" />
          {/* After — clipped */}
          <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 0 0 ${pct}%)` }}>
            <img src={after} alt="Nouvelle version" className="absolute inset-0 w-full h-full object-cover" />
          </div>
          {/* Divider */}
          <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg pointer-events-none"
            style={{ left: `${pct}%` }}>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white shadow-xl flex items-center justify-center">
              <span className="text-[--text-muted] font-mono text-xs">↔</span>
            </div>
          </div>
          {/* Labels */}
          <span className="absolute top-3 left-3 font-mono text-[11px] uppercase tracking-wider text-white bg-black/60 px-2 py-0.5 rounded-full">Avant</span>
          <span className="absolute top-3 right-3 font-mono text-[11px] uppercase tracking-wider text-white bg-black/60 px-2 py-0.5 rounded-full">Après</span>
        </div>
        {/* Close */}
        <button type="button" onClick={onClose}
          className="absolute top-3 left-1/2 -translate-x-1/2 translate-y-[calc(var(--aspect-h)+12px)] flex items-center gap-1.5 bg-black/70 text-white px-3 py-1.5 rounded-full text-xs font-body hover:bg-black/90 transition-all">
          <X size={11} /> Fermer
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

function ImagesStep({ scenes, style, masterSeed, styleReference, onScenesChange, onBack, onNext }: {
  scenes: SceneData[]
  style: FacelessStyle
  masterSeed?: number
  styleReference?: string
  onScenesChange: (scenes: SceneData[] | ((prev: SceneData[]) => SceneData[])) => void
  onBack: () => void
  onNext: () => void
}) {
  const { t } = useLanguage()
  const [generatingAll, setGeneratingAll]   = useState(false)
  const [editingId,     setEditingId]       = useState<string | null>(null)
  const [improvingId,   setImprovingId]     = useState<string | null>(null)
  const [improveResult, setImproveResult]   = useState<{
    improvedPrompt: string; explanation: string; keyChanges: string[]
  } | null>(null)
  // Comparison slider state
  const [comparing, setComparing] = useState<{ sceneId: string; before: string; after: string } | null>(null)
  // Batch selection state
  const [batchMode,  setBatchMode]  = useState(false)
  const [selected,   setSelected]   = useState<Set<string>>(new Set())
  // Fullscreen preview lightbox (scene index being previewed, or null)
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  // Style reference tracking
  const [localStyleRef, setLocalStyleRef] = useState<string | undefined>(styleReference)
  // Keep a ref to scenes to avoid stale closures in async callbacks
  const scenesRef = useRef(scenes)
  scenesRef.current = scenes
  // Scene 0 validation gate
  const [scene0Phase, setScene0Phase] = useState<'idle' | 'generating' | 'pending_validation' | 'validated'>(
    styleReference ? 'validated' : 'idle'
  )
  // Extracted style tokens from scene 0 (used to enrich scene 1..N prompts)
  const [styleTokens, setStyleTokens] = useState<{
    dominant_colors?: string[]
    lighting?: string
    texture?: string
    mood?: string
    style_prompt_suffix?: string
  } | null>(null)

  async function improvePrompt(id: string) {
    const scene = scenes.find((s) => s.id === id)
    if (!scene) return
    setImprovingId(id)
    setImproveResult(null)
    try {
      const res = await fetch('/api/improve-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: scene.imagePrompt,
          imageUrl: scene.imageUrl,
          style,
        }),
      })
      if (!res.ok) throw new Error('Improve failed')
      const data = await res.json() as { improvedPrompt: string; explanation: string; keyChanges: string[] }
      setImproveResult(data)
    } catch {
      toast.error(t('fh_promptImproveError'))
    } finally {
      setImprovingId(null)
    }
  }

  function updateScene(id: string, patch: Partial<SceneData>) {
    onScenesChange((prev) => prev.map((s) => s.id === id ? { ...s, ...patch } : s))
  }

  async function generateImage(id: string) {
    const scene = scenes.find((s) => s.id === id)
    if (!scene) return

    // Archive current image in history (max 3 versions) before overwriting
    const history = scene.imageUrl
      ? [...(scene.imageHistory ?? []).slice(-2), scene.imageUrl]
      : scene.imageHistory ?? []

    updateScene(id, { imageStatus: 'generating', streamLog: 'HD generation…', imageHistory: history, qualityHint: undefined })

    try {
      // Calculate deterministic seed: masterSeed + sceneIndex for visual consistency
      const seed = masterSeed ? masterSeed + scene.index : undefined

      // Inject style reference + extracted tokens into prompt for scenes 1..N
      // Fallback: derive a prompt from scriptText if imagePrompt is missing
      let finalPrompt = scene.imagePrompt?.trim()
        || `Cinematic scene: ${scene.scriptText.slice(0, 120)}, dramatic lighting, high quality photorealistic`
      if (scene.index > 0) {
        if (styleTokens?.style_prompt_suffix) {
          // Use extracted style tokens from Claude Vision analysis of scene 0
          finalPrompt = `${finalPrompt}. ${styleTokens.style_prompt_suffix}`
          if (styleTokens.lighting) finalPrompt += `, ${styleTokens.lighting} lighting`
          if (styleTokens.texture) finalPrompt += `, ${styleTokens.texture} texture`
        } else if (localStyleRef) {
          // Fallback: generic style reference if tokens not yet extracted
          finalPrompt = `${finalPrompt}\nStyle reference: consistent with first scene image. Maintain same lighting, color palette, composition, and visual treatment.`
        }
      }

      // ── Single-pass generation via fal-ai/flux/schnell (8 steps, 1536×864) ─
      // Previously: two-phase (schnell preview + flux/dev HD). Removed because
      // (a) 2× fal.ai requests saturated the 10-concurrent cap at 40+ scenes,
      // (b) the preview→HD swap sometimes flashed blank or illegible frames.
      // One call, one final image. Style consistency via styleTokens in prompt.
      const res = await fetch('/api/stream-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: finalPrompt, style, seed }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string }
        throw new Error(errData.error ?? `HTTP ${res.status}`)
      }

      const data = await res.json() as { imageUrl?: string }
      if (!data.imageUrl) {
        throw new Error('Génération sans URL — réessaie.')
      }

      updateScene(id, {
        imageStatus: 'done',
        imageUrl: data.imageUrl,
        qualityHint: 'hd',
        streamLog: undefined,
      })

      // Capture style reference from scene 0 for downstream scene consistency
      if (scene.index === 0 && !localStyleRef) {
        setLocalStyleRef(data.imageUrl)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[generateImage] Scene ${scene.index}:`, msg)
      toast.error(`Scene ${scene.index + 1}: ${msg.slice(0, 120)}`)
      updateScene(id, { imageStatus: 'error', streamLog: undefined, qualityHint: undefined })
    }
  }

  /**
   * Scene 0 gate flow:
   * 1. Generate scene 0 first (sets visual direction)
   * 2. Wait for user validation → captures style reference
   * 3. Generate scenes 1..N with style reference from scene 0
   */
  async function generateScene0() {
    const scene0 = scenesRef.current.find((s) => s.index === 0)
    if (!scene0) return
    setScene0Phase('generating')
    setGeneratingAll(true)
    await generateImage(scene0.id)
    setGeneratingAll(false)
    setScene0Phase('pending_validation')
  }

  async function validateScene0() {
    // Use ref to get latest scenes (avoids stale closure after generateImage updates)
    const scene0 = scenesRef.current.find((s) => s.index === 0)
    if (!scene0?.imageUrl) {
      console.error('[validateScene0] scene0 imageUrl missing. scene0:', JSON.stringify(scene0 ? { id: scene0.id, index: scene0.index, imageStatus: scene0.imageStatus, imageUrl: scene0.imageUrl?.slice(0, 50) } : null))
      toast.error(t('fh_scene0NotReady'))
      return
    }
    // Capture style reference from scene 0 HD image
    if (!localStyleRef && scene0.imageUrl) {
      setLocalStyleRef(scene0.imageUrl)
    }

    // Extract style tokens via Claude Vision (non-blocking — don't hold up validation)
    fetch('/api/extract-style-tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: scene0.imageUrl, style }),
    })
      .then((res) => res.ok ? res.json() : null)
      .then((tokens) => {
        if (tokens?.style_prompt_suffix) {
          setStyleTokens(tokens)
          toast.success(t('fh_tokensExtracted'))
        }
      })
      .catch(() => {
        // Non-critical — style reference URL is the primary mechanism
      })

    setScene0Phase('validated')
    toast.success(t('fh_scene0Validated'))
  }

  async function generateRemaining() {
    setGeneratingAll(true)
    const remaining = scenes.filter((s) => s.index > 0 && s.imageStatus !== 'done')
    // Real concurrency pool — not just a stagger. The old `Promise.all` with
    // a 300ms setTimeout delay only spaced the starts but then left every
    // scene running in parallel; for 40+ scene projects this routinely
    // saturated fal.ai's 10-concurrent-requests cap and returned HTTP 429.
    //
    // With `FAL_CONCURRENCY = 5` we run at most 5 scenes at a time. Each
    // scene fires preview+HD sequentially internally, so that's max 5
    // concurrent fal.ai calls — well under the 10-limit with room for
    // unrelated page traffic (preview regenerations, scene-0 retries, etc.)
    await runWithConcurrency(remaining, FAL_CONCURRENCY, (s) => generateImage(s.id))
    setGeneratingAll(false)
    toast.success(t('fh_allImagesGenerated'))
  }

  async function generateAll() {
    if (scene0Phase === 'idle') {
      // Start with scene 0 gate
      await generateScene0()
      return
    }
    if (scene0Phase === 'validated') {
      // Scene 0 already validated — generate remaining
      await generateRemaining()
      return
    }
    // Fallback: generate all without gate (e.g., re-run)
    setGeneratingAll(true)
    const pending = scenes.filter((s) => s.imageStatus !== 'done')
    await Promise.all(pending.map((s, i) =>
      new Promise<void>((resolve) => setTimeout(() => generateImage(s.id).then(resolve).catch(resolve), i * 300))
    ))
    setGeneratingAll(false)
    toast.success(t('fh_allImagesGenerated'))
  }

  async function regenerateSelected() {
    const ids = Array.from(selected)
    setSelected(new Set())
    setBatchMode(false)
    await Promise.all(ids.map((id) => generateImage(id)))
    toast.success(`${ids.length} scène${ids.length > 1 ? 's' : ''} régénérée${ids.length > 1 ? 's' : ''}`)
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const allDone = scenes.every((s) => s.imageStatus === 'done')
  const doneCnt = scenes.filter((s) => s.imageStatus === 'done').length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Comparison slider overlay */}
      {comparing && (
        <ComparisonSlider before={comparing.before} after={comparing.after} onClose={() => setComparing(null)} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div>
          <h2 className="font-display text-base font-bold text-foreground">Génération des images</h2>
          <p className="font-body text-xs text-[--text-muted]">{doneCnt}/{scenes.length} images générées</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setBatchMode((v) => !v); setSelected(new Set()) }}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-body transition-all',
              batchMode
                ? 'bg-blue-500/10 border-blue-500 text-blue-500'
                : 'border-border text-[--text-muted] hover:text-foreground hover:border-blue-500/40'
            )}>
            {batchMode ? <Check size={12} /> : <Settings2 size={12} />}
            {batchMode ? t('fh_batchActive') : t('fh_batchMultiple')}
          </button>
          <button type="button" onClick={generateAll} disabled={generatingAll || allDone || scene0Phase === 'pending_validation'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs font-body text-[--text-muted] hover:text-foreground hover:border-blue-500/40 transition-all disabled:opacity-40">
            {generatingAll ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {allDone ? t('fh_allGenerated')
              : scene0Phase === 'idle' ? t('fh_generateScene0')
              : scene0Phase === 'pending_validation' ? t('fh_validateScene0')
              : generatingAll ? t('fh_generating')
              : t('fh_generateRemaining')}
          </button>
        </div>
      </div>

      {/* Batch action bar */}
      {batchMode && selected.size > 0 && (
        <div className="px-6 py-2.5 bg-blue-500/10 border-b border-blue-500/20 flex items-center gap-3 shrink-0">
          <p className="font-mono text-xs text-blue-500 flex-1">
            {selected.size} scène{selected.size > 1 ? 's' : ''} sélectionnée{selected.size > 1 ? 's' : ''}
          </p>
          <button type="button" onClick={() => setSelected(new Set())}
            className="text-xs text-[--text-muted] hover:text-foreground transition-colors">
            Tout désélectionner
          </button>
          <button type="button" onClick={regenerateSelected}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500 text-white text-xs font-display font-semibold hover:bg-blue-500/90 transition-all">
            <RefreshCw size={11} /> Régénérer {selected.size} scène{selected.size > 1 ? 's' : ''}
          </button>
        </div>
      )}

      {/* Scene 0 validation gate banner */}
      {scene0Phase === 'pending_validation' && (
        <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 flex items-center gap-4 shrink-0">
          <div className="flex-1">
            <p className="font-display font-semibold text-sm text-amber-800">Validez la direction visuelle</p>
            <p className="text-xs text-amber-600 mt-0.5">
              La scène 0 définit le style de toute la vidéo. Validez-la ou régénérez-la avant de continuer.
            </p>
          </div>
          <button
            type="button"
            onClick={() => generateImage(scenes.find((s) => s.index === 0)?.id ?? '')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-300 text-xs font-body text-amber-700 hover:bg-amber-100 transition-all"
          >
            <RefreshCw size={11} /> Régénérer
          </button>
          <button
            type="button"
            onClick={validateScene0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-display font-semibold hover:bg-emerald-700 transition-all"
          >
            <Check size={12} /> Valider et continuer
          </button>
        </div>
      )}

      {scene0Phase === 'validated' && scenes.some((s) => s.index > 0 && s.imageStatus !== 'done') && (
        <div className="px-6 py-2.5 bg-emerald-50 border-b border-emerald-200 flex items-center gap-3 shrink-0">
          <Check size={14} className="text-emerald-600" />
          <p className="text-xs text-emerald-700 flex-1">
            {t('fh_scene0ValidatedRef')}
          </p>
          <button
            type="button"
            onClick={generateRemaining}
            disabled={generatingAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-display font-semibold hover:bg-emerald-700 transition-all disabled:opacity-50"
          >
            {generatingAll ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
            Generate the {scenes.filter((s) => s.index > 0 && s.imageStatus !== 'done').length} remaining scenes
          </button>
        </div>
      )}

      {/* Image grid */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="grid grid-cols-3 gap-4">
          {scenes.map((scene, i) => (
            <div key={scene.id} className="rounded-2xl border border-border overflow-hidden bg-muted">
              {/* Image preview */}
              <div className={cn('h-36 relative bg-gradient-to-br', SCENE_COLORS[i % SCENE_COLORS.length])}>
                {scene.imageStatus === 'generating' ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-3">
                    <Loader2 size={24} className="text-white/60 animate-spin" />
                    <p className="font-mono text-[11px] text-white/50 uppercase tracking-widest">Génération…</p>
                    {scene.streamLog && (
                      <p className="font-mono text-[8px] text-white/30 text-center truncate w-full px-2 mt-0.5">
                        {scene.streamLog.slice(0, 48)}
                      </p>
                    )}
                  </div>
                ) : scene.imageStatus === 'done' ? (
                  scene.imageUrl ? (
                    <button
                      type="button"
                      onClick={() => setPreviewIndex(i)}
                      aria-label={`Prévisualiser Scène ${i + 1} en grand`}
                      className="absolute inset-0 cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-0"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={scene.imageUrl}
                        alt={`Scène ${i + 1}`}
                        className="absolute inset-0 w-full h-full object-cover"
                        onError={() => {
                          // URL expirée ou inaccessible → remet la scène en état de régénération
                          console.warn(`[image] Scene ${i + 1} failed to load: ${scene.imageUrl?.slice(0, 80)}`)
                          updateScene(scene.id, { imageStatus: 'error', imageUrl: undefined })
                        }}
                      />
                    </button>
                  ) : (
                    <button
                      type="button"
                      aria-label={t('fh_regenScene')}
                      onClick={() => generateImage(scene.id)}
                      className="absolute inset-0 flex flex-col items-center justify-center gap-2 hover:bg-white/5 transition-colors group"
                    >
                      <div className="w-10 h-10 rounded-full border-2 border-amber-300/60 group-hover:border-amber-200 flex items-center justify-center transition-all">
                        <RefreshCw size={14} className="text-amber-200" />
                      </div>
                      <p className="font-mono text-[10px] text-amber-200/80 uppercase tracking-wider">Aperçu indisponible</p>
                    </button>
                  )
                ) : scene.imageStatus === 'error' ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                    <X size={18} className="text-red-300" />
                    <p className="font-mono text-[11px] text-red-300 uppercase tracking-wider">Error</p>
                  </div>
                ) : (
                  <button type="button" onClick={() => generateImage(scene.id)}
                    className="absolute inset-0 flex flex-col items-center justify-center gap-2 hover:bg-white/5 transition-colors group">
                    <div className="w-10 h-10 rounded-full border-2 border-white/30 group-hover:border-white/60 flex items-center justify-center transition-all">
                      <Play size={14} className="text-white/60 group-hover:text-white transition-colors" />
                    </div>
                    <p className="font-mono text-[11px] text-white/40 group-hover:text-white/70 uppercase tracking-widest transition-colors">Generate</p>
                  </button>
                )}

                {/* Batch checkbox */}
                {batchMode && (
                  <button
                    type="button"
                    onClick={() => toggleSelect(scene.id)}
                    className={cn(
                      'absolute top-2 left-2 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all z-10',
                      selected.has(scene.id)
                        ? 'bg-blue-500 border-blue-500'
                        : 'bg-black/40 border-white/40 hover:border-white'
                    )}>
                    {selected.has(scene.id) && <Check size={10} className="text-white" />}
                  </button>
                )}

                {/* Scene badge */}
                <span className={cn('absolute font-mono text-[11px] uppercase tracking-wider bg-black/50 text-white px-2 py-0.5 rounded-full transition-all', batchMode ? 'top-2 left-8' : 'top-2 left-2')}>
                  Scène {i + 1}
                </span>

                {/* Quality badge */}
                {scene.imageStatus === 'done' && scene.qualityHint === 'draft' && (
                  <span className="absolute bottom-2 right-2 font-mono text-[8px] uppercase tracking-wider bg-amber-500/80 text-white px-1.5 py-0.5 rounded-full">
                    Draft
                  </span>
                )}
                {scene.imageStatus === 'done' && scene.qualityHint === 'hd' && (
                  <span className="absolute bottom-2 right-2 font-mono text-[8px] uppercase tracking-wider bg-emerald-500/80 text-white px-1.5 py-0.5 rounded-full">
                    HD
                  </span>
                )}

                {/* Edit / regen controls */}
                <div className="absolute top-2 right-2 flex items-center gap-1">
                  {/* Fullscreen preview button — only when an image exists */}
                  {scene.imageUrl && scene.imageStatus === 'done' && (
                    <button
                      type="button"
                      aria-label={t('fh_previewLarge')}
                      onClick={() => setPreviewIndex(i)}
                      className="w-6 h-6 rounded-lg bg-black/40 text-white/70 hover:bg-black/70 flex items-center justify-center transition-all"
                      title={t('fh_previewLarge')}
                    >
                      <Wand2 size={10} />
                    </button>
                  )}
                  {/* Compare button — shown when there's a previous version */}
                  {scene.imageUrl && scene.imageHistory && scene.imageHistory.length > 0 && (
                    <button
                      type="button"
                      aria-label={t('fh_compareVersions')}
                      onClick={() => setComparing({
                        sceneId: scene.id,
                        before: scene.imageHistory![scene.imageHistory!.length - 1],
                        after: scene.imageUrl!,
                      })}
                      className="w-6 h-6 rounded-lg bg-black/40 text-white/70 hover:bg-purple-500/80 flex items-center justify-center transition-all"
                      title={t('fh_compareBefore')}
                    >
                      <ArrowLeft size={8} className="translate-x-px" />
                      <ArrowRight size={8} className="-translate-x-px" />
                    </button>
                  )}
                  <button type="button" aria-label="Modifier le prompt" onClick={() => setEditingId(editingId === scene.id ? null : scene.id)}
                    className={cn('w-6 h-6 rounded-lg flex items-center justify-center transition-all', editingId === scene.id ? 'bg-blue-500 text-white' : 'bg-black/40 text-white/70 hover:bg-black/60')}>
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
                      placeholder={t('fh_promptImage')} rows={3}
                      className="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-[11px] font-mono text-foreground focus:outline-none focus:border-blue-500 resize-none" />

                    {/* Overlay text — incruste du texte sur l'image au montage (drawtext ffmpeg).
                        Évite les textes illisibles générés par flux. Max 200 chars. */}
                    <div className="space-y-1">
                      <label className="block font-mono text-[10px] uppercase tracking-widest text-[--text-muted]">
                        Texte à l'écran (optionnel)
                      </label>
                      <input
                        type="text"
                        value={scene.overlayText ?? ''}
                        onChange={(e) => updateScene(scene.id, { overlayText: e.target.value.slice(0, 200) })}
                        placeholder={t('fh_overlayExample')}
                        maxLength={200}
                        className="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-[11px] font-body text-foreground focus:outline-none focus:border-blue-500"
                      />
                      {scene.overlayText && scene.overlayText.length > 0 && (
                        <p className="text-[10px] text-[--text-muted]">
                          {scene.overlayText.length}/200 · incrusté en bas du clip
                        </p>
                      )}
                    </div>

                    {/* Improve prompt panel */}
                    {improveResult && improvingId === null && (
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2.5 space-y-1.5">
                        <p className="font-mono text-[11px] uppercase tracking-widest text-blue-500">✨ Suggestion Claude</p>
                        <p className="font-mono text-[11px] text-foreground leading-relaxed">{improveResult.improvedPrompt}</p>
                        <p className="text-[11px] text-[--text-muted] italic">{improveResult.explanation}</p>
                        <button type="button"
                          onClick={() => {
                            updateScene(scene.id, { imagePrompt: improveResult.improvedPrompt })
                            setImproveResult(null)
                          }}
                          className="w-full py-1 rounded-md bg-blue-500 text-white text-[11px] font-display font-semibold hover:bg-blue-500/90 transition-all">
                          Utiliser ce prompt
                        </button>
                      </div>
                    )}

                    <div className="flex gap-1.5">
                      <button type="button"
                        onClick={() => improvePrompt(scene.id)}
                        disabled={improvingId === scene.id}
                        className="flex items-center gap-1 flex-1 py-1.5 rounded-lg border border-purple-500/30 text-purple-500 bg-purple-500/5 text-xs font-body hover:bg-purple-500/10 transition-all disabled:opacity-50">
                        {improvingId === scene.id
                          ? <Loader2 size={10} className="animate-spin" />
                          : <Sparkles size={10} />}
                        Améliorer via IA
                      </button>
                      <button type="button" onClick={() => { generateImage(scene.id); setEditingId(null); setImproveResult(null) }}
                        className="flex-1 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-display font-semibold hover:bg-blue-500/90 transition-all">
                        Régénérer
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] font-body text-[--text-muted] leading-snug line-clamp-3">{scene.scriptText}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted shrink-0">
        <button type="button" onClick={onBack} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-sm font-body text-[--text-muted] hover:text-foreground transition-all">
          <ArrowLeft size={14} /> Retour
        </button>
        <div className="flex items-center gap-3">
          {!allDone && (
            <p className="text-xs font-body text-[--text-muted]">{scenes.length - doneCnt} image(s) restante(s)</p>
          )}
          <button type="button" onClick={onNext} disabled={!allDone}
            className={cn('flex items-center gap-2 px-5 py-2 rounded-xl font-display font-semibold text-sm transition-all',
              allDone ? 'bg-gray-900 text-white hover:bg-gray-800' : 'bg-card border border-border text-[--text-muted] cursor-not-allowed')}>
            Generate clips <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* Fullscreen preview lightbox */}
      {previewIndex !== null && scenes[previewIndex] && (
        <ScenePreviewLightbox
          scenes={scenes}
          index={previewIndex}
          onClose={() => setPreviewIndex(null)}
          onNavigate={(newIndex) => setPreviewIndex(newIndex)}
          onRegenerate={(id) => generateImage(id)}
        />
      )}
    </div>
  )
}

// ── Scene preview lightbox (images + clips) ───────────────────────────────────

function ScenePreviewLightbox({
  scenes,
  index,
  onClose,
  onNavigate,
  onRegenerate,
  mode = 'image',
}: {
  scenes: SceneData[]
  index: number
  onClose: () => void
  onNavigate: (newIndex: number) => void
  onRegenerate?: (id: string) => void
  mode?: 'image' | 'clip'
}) {
  const { t } = useLanguage()
  const scene = scenes[index]
  const [mediaError, setMediaError] = useState(false)
  const [mediaLoading, setMediaLoading] = useState(true)

  // ── Focus trap : capture le focus à l'ouverture, le restaure à la fermeture ──
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    // Focus le bouton de fermeture à l'ouverture (UX attendue en dialog modal)
    closeBtnRef.current?.focus()

    const FOCUSABLE = 'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key === 'ArrowLeft' && index > 0) onNavigate(index - 1)
      if (e.key === 'ArrowRight' && index < scenes.length - 1) onNavigate(index + 1)
      // Focus trap : boucle le Tab dans la lightbox
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
        ).filter((el) => !el.hasAttribute('aria-hidden'))
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      // Restore focus à l'élément qui avait le focus avant l'ouverture
      previouslyFocused?.focus?.()
    }
  }, [index, scenes.length, onClose, onNavigate])

  if (!scene) return null

  // En mode clip, si le clipUrl est absent (ex: mode storyboard / non encore animé),
  // on retombe proprement sur l'image afin d'afficher quelque chose d'utile.
  const effectiveMode: 'image' | 'clip' = mode === 'clip' && !scene.clipUrl && scene.imageUrl ? 'image' : mode
  const mediaUrl = effectiveMode === 'clip' ? scene.clipUrl : scene.imageUrl

  // Reset load state when the media URL changes (navigation / mode switch / regeneration)
  useEffect(() => {
    setMediaError(false)
    setMediaLoading(Boolean(mediaUrl))
  }, [mediaUrl])
  const hasPrev = index > 0
  const hasNext = index < scenes.length - 1

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Prévisualisation scène ${index + 1}`}
      className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onClose}
    >
      {/* Close */}
      <button
        ref={closeBtnRef}
        type="button"
        aria-label={t('fh_closePreview')}
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all"
      >
        <X size={18} />
      </button>

      {/* Prev */}
      {hasPrev && (
        <button
          type="button"
          aria-label={t('fh_prevScene')}
          onClick={(e) => { e.stopPropagation(); onNavigate(index - 1) }}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all"
        >
          <ArrowLeft size={18} />
        </button>
      )}

      {/* Next */}
      {hasNext && (
        <button
          type="button"
          aria-label={t('fh_nextScene')}
          onClick={(e) => { e.stopPropagation(); onNavigate(index + 1) }}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all"
        >
          <ArrowRight size={18} />
        </button>
      )}

      {/* Content */}
      <div
        className="max-w-5xl w-full h-full max-h-[90vh] flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Media — checkered background so white / light images are visible */}
        <div
          className="flex-1 min-h-[40vh] flex items-center justify-center rounded-2xl overflow-hidden relative"
          style={{
            backgroundColor: '#1a1a1a',
            backgroundImage:
              'linear-gradient(45deg, #2a2a2a 25%, transparent 25%), linear-gradient(-45deg, #2a2a2a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #2a2a2a 75%), linear-gradient(-45deg, transparent 75%, #2a2a2a 75%)',
            backgroundSize: '24px 24px',
            backgroundPosition: '0 0, 0 12px, 12px -12px, -12px 0',
          }}
        >
          {!mediaUrl || mediaError ? (
            <div className="flex flex-col items-center gap-3 p-12 text-center bg-black/60 rounded-xl">
              <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
                <AlertTriangle size={22} className="text-amber-300" />
              </div>
              <p className="text-white/80 font-display text-sm font-semibold">
                {mediaError ? t('fh_cannotLoadPreview') : t('fh_noPreviewAvailable')}
              </p>
              <p className="text-white/50 font-body text-xs max-w-sm">
                {mediaError
                  ? t('fh_linkExpired')
                  : t('fh_regenForPreview')}
              </p>
              {onRegenerate && (
                <button
                  type="button"
                  onClick={() => onRegenerate(scene.id)}
                  className="mt-2 flex items-center gap-1.5 px-3 h-9 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-display font-semibold transition-all"
                >
                  <RefreshCw size={13} /> Régénérer
                </button>
              )}
            </div>
          ) : effectiveMode === 'clip' ? (
            <>
              <video
                key={mediaUrl}
                src={mediaUrl}
                controls
                autoPlay
                playsInline
                onError={() => { setMediaError(true); setMediaLoading(false) }}
                onLoadedData={() => setMediaLoading(false)}
                className="max-w-full max-h-full object-contain relative z-10"
              />
              {mediaLoading && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30">
                  <div className="w-12 h-12 rounded-full border-4 border-white/20 border-t-white/80 animate-spin" aria-label="Chargement" />
                </div>
              )}
            </>
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={mediaUrl}
                src={mediaUrl}
                alt={`Scène ${index + 1}`}
                onError={() => { setMediaError(true); setMediaLoading(false) }}
                onLoad={() => setMediaLoading(false)}
                className="max-w-full max-h-full object-contain relative z-10 shadow-2xl"
                style={{ border: '1px solid rgba(255,255,255,0.15)' }}
              />
              {mediaLoading && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30">
                  <div className="w-12 h-12 rounded-full border-4 border-white/20 border-t-white/80 animate-spin" aria-label="Chargement" />
                </div>
              )}
            </>
          )}
        </div>

        {/* Info bar */}
        <div className="flex items-start justify-between gap-4 px-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-mono text-[11px] uppercase tracking-widest bg-white/10 text-white px-2 py-0.5 rounded-full">
                Scène {index + 1} / {scenes.length}
              </span>
              {effectiveMode === 'image' && scene.qualityHint === 'hd' && (
                <span className="font-mono text-[10px] uppercase tracking-wider bg-emerald-500/80 text-white px-1.5 py-0.5 rounded-full">HD</span>
              )}
              {effectiveMode === 'image' && scene.qualityHint === 'draft' && (
                <span className="font-mono text-[10px] uppercase tracking-wider bg-amber-500/80 text-white px-1.5 py-0.5 rounded-full">Draft</span>
              )}
            </div>
            <p className="text-sm text-white/80 leading-relaxed line-clamp-3">
              {scene.scriptText}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {mediaUrl && (
              <>
                <a
                  href={mediaUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={t('fh_openNewTab')}
                  className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all"
                  title={t('fh_openNewTab')}
                >
                  <ArrowRight size={14} className="rotate-[-45deg]" />
                </a>
                <a
                  href={mediaUrl}
                  download
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={t('fh_download')}
                  className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all"
                  title={t('fh_download')}
                >
                  <Download size={14} />
                </a>
              </>
            )}
            {onRegenerate && (
              <button
                type="button"
                onClick={() => onRegenerate(scene.id)}
                aria-label={t('fh_regenerate')}
                className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-display font-semibold transition-all"
              >
                <RefreshCw size={13} /> Régénérer
              </button>
            )}
          </div>
        </div>

        {/* Keyboard hint */}
        <p className="text-center text-[11px] text-white/40 font-mono">
          ← / → pour naviguer · Échap pour fermer · Clique sur l'icône ↗ pour ouvrir l'image source
        </p>
      </div>
    </div>
  )
}

// ── Step 4 — Clips + Voice-over ────────────────────────────────────────────────

function ClipsStep({ scenes, onScenesChange, voiceId, onBack, onNext, videoId, onReassembled, style, animationMode, onAnimationModeChange }: {
  scenes: SceneData[]
  onScenesChange: (scenes: SceneData[] | ((prev: SceneData[]) => SceneData[])) => void
  voiceId: string
  onBack: () => void
  onNext: () => void
  videoId?: string
  // Signature sans argument : l'URL finale est résolue par `FinalStep` via
  // `useVideoStatus` (Supabase realtime) dès que le backend passe la vidéo
  // en `status='done'`. Plus besoin de la réponse synchrone de l'API.
  onReassembled?: () => void
  style?: string
  animationMode: AnimationMode
  onAnimationModeChange: (mode: AnimationMode) => void
}) {
  const { t } = useLanguage()
  const [generatingAll,  setGeneratingAll]  = useState(false)
  const [voiceStatus,    setVoiceStatus]    = useState<'idle' | 'generating' | 'done'>('idle')
  const [editingId,      setEditingId]      = useState<string | null>(null)
  const [hasRegenerated, setHasRegenerated] = useState(false)
  const [reassembling,   setReassembling]   = useState(false)
  const [previewIndex,   setPreviewIndex]   = useState<number | null>(null)

  function updateScene(id: string, patch: Partial<SceneData>) {
    onScenesChange((prev) => prev.map((s) => s.id === id ? { ...s, ...patch } : s))
  }

  // Quand l'utilisateur sélectionne 'storyboard' (bypass animation),
  // toutes les scènes sont considérées comme prêtes (Ken Burns appliqué côté backend).
  // Quand il repasse à 'fast'/'pro', on remet les scènes sans clipUrl en 'idle' pour générer.
  useEffect(() => {
    if (animationMode === 'storyboard') {
      onScenesChange((prev) => prev.map((s) =>
        s.clipStatus !== 'done' ? { ...s, clipStatus: 'done', clipUrl: undefined } : s
      ))
    } else {
      onScenesChange((prev) => prev.map((s) =>
        s.clipStatus === 'done' && !s.clipUrl ? { ...s, clipStatus: 'idle' } : s
      ))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animationMode])

  async function generateClip(id: string) {
    const scene = scenes.find((s) => s.id === id)
    if (!scene) return
    // Mode 'storyboard' → pas de génération Kling, Ken Burns appliqué côté backend.
    // On marque simplement la scène comme prête (clipUrl reste vide).
    if (animationMode === 'storyboard') {
      updateScene(id, { clipStatus: 'done', clipUrl: undefined })
      return
    }
    // Si l'image n'est pas encore générée, marquer simplement comme prêt (la génération réelle se fait en pipeline)
    if (!scene.imageUrl) {
      updateScene(id, { clipStatus: 'done' })
      return
    }
    updateScene(id, { clipStatus: 'generating' })
    try {
      if (videoId) {
        const data = await regenerateFacelessClip({
          video_id: videoId,
          scene_id: id,
          image_url: scene.imageUrl,
          animation_prompt: scene.animationPrompt || 'smooth cinematic camera movement, natural motion',
          duration: '5',
        })
        updateScene(id, { clipStatus: 'done', clipUrl: data.clip_url })
        setHasRegenerated(true)
      } else {
        // Fallback pour les clips générés en frontend avant soumission
        const res = await fetch('/api/generate-scene-clip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl: scene.imageUrl,
            animationPrompt: scene.animationPrompt || 'smooth cinematic camera movement, natural motion',
            duration: '5',
            style,
          }),
        })
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
          throw new Error(errBody.error ?? `Clip generation failed (HTTP ${res.status})`)
        }
        const data = await res.json() as { videoUrl: string; model: string }
        updateScene(id, { clipStatus: 'done', clipUrl: data.videoUrl })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[generateClip scene=${id}]`, msg, err)
      toast.error(`Scène ${scene.index + 1} : ${msg}`)
      updateScene(id, { clipStatus: 'error' })
    }
  }

  async function regenImageAndClip(id: string) {
    if (!videoId) return
    const scene = scenes.find((s) => s.id === id)
    if (!scene) return
    updateScene(id, { imageStatus: 'generating', clipStatus: 'generating' })
    try {
      // Step 1: regenerate image
      const imgData = await regenerateFacelessScene({ video_id: videoId, scene_id: id })
      const newImageUrl = imgData.data.image_url
      updateScene(id, { imageStatus: 'done', imageUrl: newImageUrl })

      // Step 2: regenerate clip from new image
      const clipData = await regenerateFacelessClip({
        video_id: videoId,
        scene_id: id,
        image_url: newImageUrl,
        animation_prompt: scene.animationPrompt || 'smooth cinematic camera movement, natural motion',
        duration: '5',
      })
      updateScene(id, { clipStatus: 'done', clipUrl: clipData.clip_url })
      setHasRegenerated(true)
      toast.success(`Scène ${scene.index + 1} régénérée`)
    } catch {
      toast.error(`Erreur régénération scène ${scene.index + 1}`)
      updateScene(id, { imageStatus: 'error', clipStatus: 'error' })
    }
  }

  async function handleReassemble() {
    if (!videoId) return
    setReassembling(true)
    try {
      // L'API répond immédiatement en 202 Accepted avec status='assembly'.
      // Le travail lourd (FFmpeg + upload Supabase) continue en fond.
      // On transitionne vers FinalStep tout de suite : useVideoStatus y
      // détectera le passage à 'done' et affichera la vidéo.
      await reassembleFacelessVideo(videoId)
      setHasRegenerated(false)
      onReassembled?.()
      toast.success(t('fh_assemblyInProgress'))
    } catch {
      toast.error(t('fh_reassemblyError'))
    } finally {
      setReassembling(false)
    }
  }

  function generateVoice() {
    setVoiceStatus('done')
  }

  async function generateAll() {
    // En mode 'storyboard' (Ken Burns), aucun clip Kling n'est nécessaire.
    if (animationMode === 'storyboard') {
      onScenesChange((prev) => prev.map((s) => ({ ...s, clipStatus: 'done', clipUrl: undefined })))
      if (voiceId) setVoiceStatus('done')
      toast.success(t('fh_scenesReadyKB'))
      return
    }
    setGeneratingAll(true)
    const pending = scenes.filter((s) => s.clipStatus !== 'done')
    await Promise.all(pending.map((s) => generateClip(s.id)))
    if (voiceId) setVoiceStatus('done')
    setGeneratingAll(false)
    toast.success(t('fh_clipsGenerated'))
  }

  const allClipsDone = animationMode === 'storyboard'
    ? true // Ken Burns géré côté backend : toutes les scènes sont prêtes dès que le mode est sélectionné
    : scenes.every((s) => s.clipStatus === 'done')
  const doneCnt = scenes.filter((s) => s.clipStatus === 'done').length

  // Durée totale estimée (secondes) : audioDuration réelle si dispo, sinon duree_estimee
  const estimatedTotalSec = Math.round(
    scenes.reduce((acc, s) => acc + (s.audioDuration ?? s.duree_estimee ?? 5), 0),
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div>
          <h2 className="font-display text-base font-bold text-foreground">Génération des clips</h2>
          <p className="font-body text-xs text-[--text-muted]">
            {animationMode === 'storyboard'
              ? `Mode images fixes · ${scenes.length} scènes prêtes`
              : `${doneCnt}/${scenes.length} clips`} · voix off {voiceStatus === 'done' ? '✓ ready' : 'en attente'}
          </p>
        </div>
        {animationMode !== 'storyboard' && (
          <button type="button" onClick={generateAll} disabled={generatingAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs font-body text-[--text-muted] hover:text-foreground transition-all disabled:opacity-40">
            {generatingAll ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Tout générer
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        {/* Animation mode selector — Storyboard (bypass) | Fast (Kling Std) | Pro (Kling Pro) */}
        <div className="rounded-2xl border border-border bg-muted p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-display text-sm font-semibold text-foreground">Animation des scènes</p>
              <p className="font-body text-xs text-[--text-muted]">
                Choisissez entre images fixes (rapide) ou clips animés IA (lent mais plus vivant).
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {([
              { id: 'storyboard', label: t('fh_stillImages'), sub: t('fh_stillImagesSub'), emoji: '🖼️' },
              { id: 'fast',       label: t('fh_fastAnim'), sub: t('fh_fastAnimSub'), emoji: '⚡' },
              { id: 'pro',        label: t('fh_proAnim'), sub: t('fh_proAnimSub'), emoji: '✨' },
            ] as Array<{ id: AnimationMode; label: string; sub: string; emoji: string }>).map((opt) => {
              const selected = animationMode === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onAnimationModeChange(opt.id)}
                  className={cn(
                    'rounded-xl border px-3 py-2.5 text-left transition-all',
                    selected
                      ? 'border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/30'
                      : 'border-border bg-card hover:border-blue-500/40'
                  )}
                >
                  <p className="font-display text-[13px] font-semibold text-foreground flex items-center gap-1.5">
                    <span>{opt.emoji}</span> {opt.label}
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-[--text-muted] mt-0.5">{opt.sub}</p>
                </button>
              )
            })}
          </div>
          {animationMode === 'storyboard' && (
            <p className="font-body text-[11px] text-[--text-muted] border-t border-border pt-2">
              ✓ Images fixes avec effets Ken Burns (zoom doux) et transitions cross-fade entre scènes.
              Pas de génération de clips IA — assemblage plus rapide.
            </p>
          )}
        </div>

        {/* Clips grid — same layout as the Images step. Hidden in storyboard mode. */}
        {animationMode !== 'storyboard' && (
        <div className="grid grid-cols-3 gap-4">
          {scenes.map((scene, i) => (
            <div key={scene.id} className="rounded-2xl border border-border overflow-hidden bg-muted">
              {/* Clip preview */}
              <div className={cn('h-36 relative bg-gradient-to-br', SCENE_COLORS[i % SCENE_COLORS.length])}>
                {scene.clipStatus === 'generating' ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-3">
                    <Loader2 size={24} className="text-white/60 animate-spin" />
                    <p className="font-mono text-[11px] text-white/50 uppercase tracking-widest">Génération…</p>
                  </div>
                ) : scene.clipStatus === 'done' && scene.clipUrl ? (
                  <button
                    type="button"
                    onClick={() => setPreviewIndex(i)}
                    aria-label={`Prévisualiser clip Scène ${i + 1} en grand`}
                    className="absolute inset-0 cursor-zoom-in group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <video
                      src={scene.clipUrl}
                      className="absolute inset-0 w-full h-full object-cover"
                      muted
                      autoPlay
                      loop
                      playsInline
                      onError={() => {
                        console.warn(`[clip] Scene ${i + 1} failed to load: ${scene.clipUrl?.slice(0, 80)}`)
                        updateScene(scene.id, { clipStatus: 'error', clipUrl: undefined })
                      }}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
                        <Play size={14} className="text-black fill-black translate-x-0.5" />
                      </div>
                    </div>
                  </button>
                ) : scene.clipStatus === 'done' ? (
                  // Clip marqué done sans URL → image fixe (mode storyboard) : on affiche l'aperçu image
                  scene.imageUrl ? (
                    <button
                      type="button"
                      onClick={() => setPreviewIndex(i)}
                      aria-label={`Prévisualiser Scène ${i + 1} en grand`}
                      className="absolute inset-0 cursor-zoom-in group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={scene.imageUrl}
                        alt={`Scène ${i + 1}`}
                        className="absolute inset-0 w-full h-full object-cover"
                        onError={() => {
                          console.warn(`[image] Scene ${i + 1} thumb failed to load`)
                          updateScene(scene.id, { imageUrl: undefined })
                        }}
                      />
                    </button>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-3">
                      <Check size={14} className="text-white" />
                    </div>
                  )
                ) : scene.clipStatus === 'error' ? (
                  <button type="button" aria-label="Réessayer le clip" onClick={() => generateClip(scene.id)}
                    className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-red-500/20 hover:bg-red-500/30 transition-colors group">
                    <div className="w-10 h-10 rounded-full border-2 border-red-300 group-hover:border-red-100 flex items-center justify-center transition-all">
                      <RefreshCw size={14} className="text-red-200 group-hover:text-white transition-colors" />
                    </div>
                    <p className="font-mono text-[11px] text-red-300 uppercase tracking-wider">Retry</p>
                  </button>
                ) : (
                  <button type="button" aria-label="Générer le clip" onClick={() => generateClip(scene.id)}
                    className="absolute inset-0 flex flex-col items-center justify-center gap-2 hover:bg-white/5 transition-colors group">
                    <div className="w-10 h-10 rounded-full border-2 border-white/30 group-hover:border-white/60 flex items-center justify-center transition-all">
                      <Film size={14} className="text-white/60 group-hover:text-white transition-colors" />
                    </div>
                    <p className="font-mono text-[11px] text-white/40 group-hover:text-white/70 uppercase tracking-widest transition-colors">Generate</p>
                  </button>
                )}

                {/* Scene badge */}
                <span className="absolute top-2 left-2 font-mono text-[11px] uppercase tracking-wider bg-black/50 text-white px-2 py-0.5 rounded-full">
                  Scène {i + 1}
                </span>

                {/* Status badge (bottom-left) */}
                {scene.clipStatus === 'done' && (
                  <span className="absolute bottom-2 left-2 font-mono text-[8px] uppercase tracking-wider bg-emerald-500/80 text-white px-1.5 py-0.5 rounded-full">
                    Ready
                  </span>
                )}

                {/* Audio over-duration warning (bottom-right) */}
                {scene.audioDuration && scene.duree_estimee && scene.audioDuration > scene.duree_estimee * 1.2 && (
                  <span className="absolute bottom-2 right-2 font-mono text-[8px] uppercase tracking-wider bg-amber-500/80 text-white px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                    <AlertTriangle size={8} />
                    +{Math.round((scene.audioDuration - scene.duree_estimee))}s
                  </span>
                )}

                {/* Controls (top-right) */}
                <div className="absolute top-2 right-2 flex items-center gap-1">
                  {scene.clipStatus === 'done' && scene.clipUrl && (
                    <button
                      type="button"
                      aria-label={t('fh_previewClip')}
                      onClick={() => setPreviewIndex(i)}
                      className="w-6 h-6 rounded-lg bg-black/40 text-white/70 hover:bg-black/70 flex items-center justify-center transition-all"
                      title="Prévisualiser le clip en grand"
                    >
                      <Wand2 size={10} />
                    </button>
                  )}
                  <button type="button" aria-label="Modifier le prompt" onClick={() => setEditingId(editingId === scene.id ? null : scene.id)}
                    className={cn('w-6 h-6 rounded-lg flex items-center justify-center transition-all', editingId === scene.id ? 'bg-blue-500 text-white' : 'bg-black/40 text-white/70 hover:bg-black/60')}>
                    <Edit3 size={10} />
                  </button>
                  <button type="button" aria-label="Régénérer le clip" onClick={() => generateClip(scene.id)} disabled={scene.clipStatus === 'generating'}
                    className="w-6 h-6 rounded-lg bg-black/40 text-white/70 hover:bg-black/60 flex items-center justify-center transition-all disabled:opacity-40">
                    <RefreshCw size={10} />
                  </button>
                  {videoId && (
                    <button type="button" aria-label="Régénérer image + clip" onClick={() => regenImageAndClip(scene.id)} disabled={scene.clipStatus === 'generating' || scene.imageStatus === 'generating'}
                      title={t('fh_regenImageClip')}
                      className="w-6 h-6 rounded-lg bg-black/40 text-white/70 hover:bg-blue-500/80 flex items-center justify-center transition-all disabled:opacity-40">
                      <Sparkles size={10} />
                    </button>
                  )}
                </div>
              </div>

              {/* Animation prompt / editor */}
              <div className="p-3">
                {editingId === scene.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={scene.animationPrompt}
                      onChange={(e) => updateScene(scene.id, { animationPrompt: e.target.value })}
                      rows={3}
                      placeholder={t('fh_animPrompt')}
                      className="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-[11px] font-mono text-foreground focus:outline-none focus:border-blue-500 resize-none"
                    />
                    <button
                      type="button"
                      onClick={() => { generateClip(scene.id); setEditingId(null) }}
                      className="w-full py-1.5 rounded-lg bg-blue-500 text-white text-xs font-display font-semibold hover:bg-blue-500/90 transition-all"
                    >
                      Régénérer
                    </button>
                  </div>
                ) : (
                  <p className="text-[11px] font-body text-[--text-muted] leading-snug line-clamp-3">
                    {scene.animationPrompt}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
        )}

        {/* Voice-over section */}
        {voiceId && (
          <div className="rounded-2xl border border-border bg-muted overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
                voiceStatus === 'done' ? 'bg-emerald-50' : voiceStatus === 'generating' ? 'bg-blue-50' : 'bg-card border border-border')}>
                {voiceStatus === 'generating' ? <Loader2 size={16} className="text-blue-500 animate-spin" /> : <Volume2 size={16} className={voiceStatus === 'done' ? 'text-emerald-600' : 'text-[--text-muted]'} />}
              </div>
              <div className="flex-1">
                <p className="font-display text-sm font-semibold text-foreground">Voix off</p>
                <p className="text-xs font-body text-[--text-muted]">
                  {voiceStatus === 'done' ? t('fh_voiceDone') : voiceStatus === 'generating' ? t('fh_voiceGenerating') : t('fh_voiceWillGenerate')}
                </p>
              </div>
              {voiceStatus !== 'done' && (
                <button type="button" onClick={generateVoice} disabled={voiceStatus === 'generating'}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs font-body text-[--text-muted] hover:text-foreground transition-all disabled:opacity-40">
                  {voiceStatus === 'generating' ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
                  Générer la voix
                </button>
              )}
            </div>

            {/* Audio player */}
            {voiceStatus === 'done' && videoId && (
              <div className="px-4 py-3 border-t border-border/60">
                <p className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted] mb-2">Lecture de la voix off</p>
                <audio
                  controls
                  className="w-full h-10 rounded-lg"
                  src={`/api/v1/videos/${videoId}/audio`}
                >
                  Votre navigateur ne supporte pas la lecture audio.
                </audio>
              </div>
            )}

            {/* Sync timeline */}
            {voiceStatus === 'done' && (
              <div className="px-4 pb-4">
                <div className="bg-card rounded-xl p-3 border border-border/60">
                  <p className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted] mb-2">Synchronisation</p>
                  <div className="flex gap-1 h-8 items-center">
                    {scenes.map((_, i) => (
                      <div key={i} className={cn('flex-1 h-full rounded-md flex items-center justify-center text-[8px] font-mono text-white font-bold', ['bg-blue-500/70','bg-violet-500/70','bg-sky-500/70','bg-emerald-500/70','bg-orange-500/70','bg-pink-500/70'][i % 6])}>
                        S{i + 1}
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="font-mono text-[8px] text-[--text-muted]">0:00</span>
                    <span className="font-mono text-[8px] text-[--text-muted]">0:30</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted shrink-0">
        <button type="button" onClick={onBack} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-sm font-body text-[--text-muted] hover:text-foreground transition-all">
          <ArrowLeft size={14} /> Retour
        </button>
        <div className="flex items-center gap-2">
          {videoId && hasRegenerated && (
            <button type="button" onClick={handleReassemble} disabled={reassembling}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500 text-white font-display font-semibold text-sm hover:opacity-90 transition-all disabled:opacity-50">
              {reassembling ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              {reassembling ? t('fh_reassembling') : t('fh_reassemble')}
            </button>
          )}
          <button type="button" onClick={onNext} disabled={!allClipsDone}
            className={cn('flex items-center gap-2 px-5 py-2 rounded-xl font-display font-semibold text-sm transition-all',
              allClipsDone ? 'bg-gray-900 text-white hover:bg-gray-800' : 'bg-card border border-border text-[--text-muted] cursor-not-allowed')}>
            <span>{t('fh_assembleVideo')}</span>
            <span className="font-mono text-[11px] opacity-70 border-l border-white/20 pl-2 hidden sm:inline">
              ~{estimatedTotalSec}s · {scenes.length} {scenes.length > 1 ? 'scènes' : 'scène'}
            </span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* Fullscreen clip preview lightbox */}
      {previewIndex !== null && scenes[previewIndex] && (
        <ScenePreviewLightbox
          scenes={scenes}
          index={previewIndex}
          mode="clip"
          onClose={() => setPreviewIndex(null)}
          onNavigate={(newIndex) => setPreviewIndex(newIndex)}
          onRegenerate={(id) => generateClip(id)}
        />
      )}
    </div>
  )
}

// ── Step 5 — Final video ───────────────────────────────────────────────────────

function getStatusLabels(t: (k: string) => string): Record<string, string> {
  return {
    pending:    t('fh_statusPending'),
    processing: t('fh_statusProcessing'),
    storyboard: t('fh_statusStoryboard'),
    visuals:    t('fh_statusVisuals'),
    audio:      t('fh_statusAudio'),
    assembly:   t('fh_statusAssembly'),
    done:       t('fh_statusDone'),
    error:      t('fh_statusError'),
  }
}

function FinalStep({ project, onNew, onRetry, onVideoReady, onEditScenes }: {
  project: ProjectState
  onNew: () => void
  onRetry?: () => void
  onVideoReady?: (videoId: string, outputUrl: string) => void
  onEditScenes?: () => void
}) {
  const { t } = useLanguage()
  const { status, progress, outputUrl, errorMessage, isError, isDone } = useVideoStatus(project.videoId ?? null)
  const [downloading, setDownloading] = useState(false)
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null)
  const notifiedRef = useRef(false)
  const fallbackTriedRef = useRef(false)

  const videoUrl = outputUrl ?? fallbackUrl ?? project.finalVideoUrl

  // Fallback : si done mais pas d'URL, requêter Supabase directement
  useEffect(() => {
    if (isDone && !outputUrl && project.videoId && !fallbackTriedRef.current) {
      fallbackTriedRef.current = true
      const supabase = (async () => {
        const { createBrowserClient } = await import('@/lib/supabase')
        const sb = createBrowserClient()
        const { data } = await sb
          .from('videos')
          .select('output_url')
          .eq('id', project.videoId!)
          .single()
        if (data?.output_url) {
          setFallbackUrl(data.output_url)
        }
      })()
      supabase.catch(() => null)
    }
  }, [isDone, outputUrl, project.videoId])

  // Notifier le parent une seule fois quand la vidéo est prête
  useEffect(() => {
    if (isDone && outputUrl && project.videoId && !notifiedRef.current) {
      notifiedRef.current = true
      onVideoReady?.(project.videoId, outputUrl)
    }
  }, [isDone, outputUrl, project.videoId, onVideoReady])

  async function handleDownload() {
    const urlToFetch = videoUrl || null
    if (!urlToFetch && !project.videoId) return
    setDownloading(true)
    try {
      // Priorité 1 : fetch direct de la signed URL Supabase (pas de dépendance backend)
      // Priorité 2 : route server /api/download-video (fallback si URL indisponible)
      const res = urlToFetch
        ? await fetch(urlToFetch)
        : await fetch(`/api/download-video?id=${project.videoId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `${project.title ?? 'video'}.mp4`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
    } catch {
      toast.error(t('fh_downloadError'))
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 max-w-xl mx-auto gap-6">
      {!isDone && !isError ? (
        <div className="w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto">
            <Loader2 size={28} className="text-blue-500 animate-spin" />
          </div>
          <h2 className="font-display text-xl font-bold text-foreground">
            {getStatusLabels(t)[status] ?? t('fh_statusGenerating')}
          </h2>
          <p className="font-body text-sm text-[--text-muted]">
            {project.title || 'Faceless video'} · {project.scenes.length} scènes · {project.duration}
          </p>
          <ProgressBar value={progress} showLabel status={status} message={getStatusLabels(t)[status] ?? t('fh_statusInProgress')} />
        </div>
      ) : isError ? (
        <div className="text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto">
            <X size={26} className="text-red-500" />
          </div>
          <h2 className="font-display text-xl font-bold text-foreground">{t('fh_genErrorTitle')}</h2>
          {errorMessage ? (
            <p className="font-mono text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2 max-w-sm mx-auto text-left break-all">{errorMessage}</p>
          ) : (
            <p className="font-body text-sm text-[--text-muted]">{t('fh_genErrorDesc')}</p>
          )}
          <div className="flex items-center gap-3 justify-center">
            {onRetry && (
              <button type="button" onClick={onRetry}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-body hover:opacity-90 transition-all">
                <RotateCcw size={14} /> Relancer la génération
              </button>
            )}
            <button type="button" onClick={onNew}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border text-sm font-body text-[--text-muted] hover:text-foreground transition-all">
              <Plus size={14} /> {t('fh_newVideo')}
            </button>
          </div>
        </div>
      ) : (
        <div className="w-full space-y-5 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto">
            <Check size={26} className="text-emerald-600" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold text-foreground mb-1">Votre vidéo est prête !</h2>
            <p className="font-body text-sm text-[--text-muted]">{project.title || 'Faceless video'} · {project.scenes.length} scènes · {project.duration}</p>
          </div>

          <div className={cn('w-full rounded-2xl overflow-hidden aspect-video bg-gradient-to-br', SCENE_COLORS[0], 'flex items-center justify-center')}>
            {videoUrl ? (
              <VideoPlayer url={videoUrl} title={project.title} />
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
                  <Play size={22} className="text-white fill-white" />
                </div>
                <p className="font-mono text-[11px] text-white/60 uppercase tracking-wider">Prévisualisation</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading || !project.videoId}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gray-900 text-white font-display font-semibold text-sm hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={15} />
              {downloading ? t('fh_downloading') : t('fh_download')}
            </button>
            {onEditScenes && (
              <button type="button" onClick={onEditScenes}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border text-sm font-body text-[--text-muted] hover:text-foreground hover:border-blue-500/40 transition-all">
                <Edit3 size={14} />
                Modifier des scènes
              </button>
            )}
            <button type="button" onClick={onNew}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border text-sm font-body text-[--text-muted] hover:text-foreground hover:border-blue-500/40 transition-all">
              <Plus size={14} />
              {t('fh_newVideo')}
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
  duration: 'auto',
  description: '',
  script: '',
  audioFile: null,
  inputType: 'script',
  scenes: [],
  step: 'setup',
  animationMode: 'fast',  // default: Kling Standard (good quality/speed tradeoff)
}

const DRAFT_KEY       = 'clyro-faceless-draft'
const ACTIVE_GEN_KEY  = 'clyro-faceless-active-gen'

/** Draft payload persisted in videos.wizard_state (JSONB). Keeps only
 *  serializable fields — audioFile/videoId/finalVideoUrl are excluded. */
interface FacelessHubDraftState {
  hub: true
  title: string
  style: FacelessStyle | null
  voiceId: string
  format: VideoFormat
  duration: VideoDuration
  description: string
  script: string
  inputType: 'script' | 'audio'
  scenes: SceneData[]
  step: PipelineStep
  masterSeed?: number
  styleReference?: string
  contentTemplateId?: string
  animationMode?: AnimationMode
}

export interface InitialHubDraft {
  id: string
  wizard_state: Partial<FacelessHubDraftState> & { hub?: boolean } | null
}

function hydrateProjectFromDraft(w: InitialHubDraft['wizard_state']): ProjectState {
  const s = (w ?? {}) as Partial<FacelessHubDraftState>
  return {
    ...DEFAULT_PROJECT,
    title:             s.title            ?? DEFAULT_PROJECT.title,
    style:             (s.style           ?? DEFAULT_PROJECT.style) as FacelessStyle | null,
    voiceId:           s.voiceId          ?? DEFAULT_PROJECT.voiceId,
    format:            (s.format          ?? DEFAULT_PROJECT.format)   as VideoFormat,
    duration:          (s.duration        ?? DEFAULT_PROJECT.duration) as VideoDuration,
    description:       s.description      ?? DEFAULT_PROJECT.description,
    script:            s.script           ?? DEFAULT_PROJECT.script,
    inputType:         (s.inputType       ?? DEFAULT_PROJECT.inputType) as 'script' | 'audio',
    scenes:            Array.isArray(s.scenes) ? s.scenes : DEFAULT_PROJECT.scenes,
    step:              (s.step            ?? DEFAULT_PROJECT.step) as PipelineStep,
    masterSeed:        s.masterSeed,
    styleReference:    s.styleReference,
    contentTemplateId: s.contentTemplateId,
    animationMode:     (s.animationMode   ?? DEFAULT_PROJECT.animationMode) as AnimationMode,
  }
}

function FacelessPipeline({ onGenerated, onVideoReady, initialDraft, resumeVideoId }: {
  onGenerated: (title: string, videoId: string) => void
  onVideoReady?: (videoId: string, outputUrl: string) => void
  initialDraft?: InitialHubDraft | null
  resumeVideoId?: string | null
}) {
  const { t } = useLanguage()
  const [project,    setProject]   = useState<ProjectState>(() => {
    if (resumeVideoId) return { ...DEFAULT_PROJECT, videoId: resumeVideoId, step: 'final' }
    if (initialDraft?.wizard_state) return hydrateProjectFromDraft(initialDraft.wizard_state)
    return DEFAULT_PROJECT
  })

  // Background generation banner: shown when localStorage has an active generation
  // but no resumeVideoId was passed (e.g. user navigated to /faceless/hub directly)
  const [bgGen, setBgGen] = useState<{ videoId: string; title: string } | null>(null)
  useEffect(() => {
    if (resumeVideoId || project.videoId) return
    try {
      const raw = localStorage.getItem(ACTIVE_GEN_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as { videoId?: string; title?: string }
      if (parsed.videoId) setBgGen({ videoId: parsed.videoId, title: parsed.title || t('fh_untitled') })
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [loading,    setLoading]   = useState(false)
  const [savedState, setSavedState] = useState<'saving' | 'saved' | null>(null)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimer    = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Toast once on hydration so the user knows credits weren't re-consumed
  const hydrationToastedRef = useRef(false)
  useEffect(() => {
    if (hydrationToastedRef.current) return
    if (initialDraft?.wizard_state) {
      hydrationToastedRef.current = true
      const hasImages = project.scenes.some((sc) => sc.imageUrl)
      toast.success(
        hasImages
          ? t('fh_projectRestored')
          : t('fh_projectRestoredBasic')
      )
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Server-backed draft auto-save ────────────────────────────
  // Creates a row in videos with status='draft' as soon as the user
  // does something meaningful, so closing the tab never loses work
  // and the project appears in /projects (DraftsSection) + /drafts.
  const PIPELINE_STEPS = getPipelineSteps(t)
  const stepIdx = PIPELINE_STEPS.findIndex((s) => s.id === project.step)
  const draftState: FacelessHubDraftState = {
    hub:               true,
    title:             project.title,
    style:             project.style,
    voiceId:           project.voiceId,
    format:            project.format,
    duration:          project.duration,
    description:       project.description,
    script:            project.script,
    inputType:         project.inputType,
    scenes:            project.scenes,
    step:              project.step,
    masterSeed:        project.masterSeed,
    styleReference:    project.styleReference,
    contentTemplateId: project.contentTemplateId,
    animationMode:     project.animationMode,
  }
  // Pre-scene-breakdown: prompt the user before letting them close/refresh
  // so they have a chance to cancel. Once the script has been broken into
  // scenes (hasScenes), leave silently — the draft is always auto-saved.
  const hasScenes = project.scenes.length > 0
  const { clearDraft } = useDraftSave({
    module:         'faceless',
    title:          project.title || 'Faceless draft',
    style:          (project.style as string | null) ?? 'draft',
    currentStep:    stepIdx >= 0 ? stepIdx : 0,
    totalSteps:     PIPELINE_STEPS.length,
    stepLabel:      PIPELINE_STEPS[stepIdx]?.label ?? 'Setup',
    state:          draftState as unknown as Record<string, unknown>,
    // Once the pipeline has been kicked off, stop upserting as draft —
    // the videoId lives in a separate non-draft row from now on.
    initialDraftId: project.videoId ? null : (initialDraft?.id ?? null),
    // Native "Leave site?" prompt only before scenes exist AND before the
    // final generation has started. Post-scenes, losing work is impossible
    // (everything is already persisted) so we don't interrupt the user.
    promptOnLeave:  !hasScenes && !project.videoId,
  })

  function patch(p: Partial<ProjectState>) {
    setProject((prev) => ({ ...prev, ...p }))
  }

  /** Handles both direct scene arrays and functional updaters (for parallel-safe updates) */
  function handleScenesChange(scenesOrFn: SceneData[] | ((prev: SceneData[]) => SceneData[])) {
    if (typeof scenesOrFn === 'function') {
      setProject((prev) => ({ ...prev, scenes: scenesOrFn(prev.scenes) }))
    } else {
      patch({ scenes: scenesOrFn })
    }
  }

  // Auto-save: localStorage + Supabase PATCH (debounced 800ms) with saved indicator
  useEffect(() => {
    if (project.scenes.length === 0) return
    setSavedState('saving')
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    if (savedTimer.current)    clearTimeout(savedTimer.current)
    autoSaveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ scenes: project.scenes, savedAt: Date.now() }))
      } catch { /* quota exceeded — non-blocking */ }
      if (project.videoId) {
        updateVideoMetadata(project.videoId, { scenes: project.scenes }).catch(() => null)
      }
      setSavedState('saved')
      savedTimer.current = setTimeout(() => setSavedState(null), 2500)
    }, 800)
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
      if (savedTimer.current)    clearTimeout(savedTimer.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.scenes, project.videoId])

  async function goToStoryboard() {
    setLoading(true)
    try {
      const res = await fetch('/api/generate-storyboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: project.script || project.description || 'Introduction. Development of main ideas. Conclusion and call to \'action.',
          description: project.description || undefined,
          style: project.style ?? 'cinematique',
          duration: project.duration,
          title: project.title || undefined,
        }),
      })
      if (!res.ok) {
        const errBody = await res.text().catch(() => '')
        console.error(`[storyboard] API ${res.status}:`, errBody.slice(0, 300))
        throw new Error(`Storyboard generation failed (${res.status})`)
      }
      const data = await res.json() as {
        scenes: Array<{
          index: number
          texte_voix: string
          description_visuelle: string
          animation_prompt?: string
          duree_estimee: number
        }>
      }
      const scenes: SceneData[] = data.scenes.map((s, i) => ({
        id: `scene-${i}-${Date.now()}`,
        index: i,
        scriptText: s.texte_voix,
        imagePrompt: s.description_visuelle,
        animationPrompt: s.animation_prompt ?? 'Slow cinematic pan, atmospheric depth, smooth motion',
        imageStatus: 'idle',
        clipStatus: 'idle',
      }))
      // Generate deterministic masterSeed for visual consistency across all scenes
      const masterSeed = Math.floor(Math.random() * 2147483647)
      patch({ scenes, step: 'storyboard', masterSeed })
    } catch {
      toast.error(t('fh_cannotGenScenes'))
      const scenes = splitScriptToScenes(project.script || project.description || 'Introduction. Development. Conclusion.')
      const masterSeed = Math.floor(Math.random() * 2147483647)
      patch({ scenes, step: 'storyboard', masterSeed })
    } finally {
      setLoading(false)
    }
  }

  async function goToImages() {
    patch({ step: 'images' })
  }

  async function goToClips() {
    // Persister le styleReference capturé dans ImagesStep pour cohérence visuelle
    const firstDoneScene = project.scenes.find((s) => s.imageStatus === 'done' && s.imageUrl)
    patch({ step: 'clips', styleReference: firstDoneScene?.imageUrl || project.styleReference })
  }

  async function goToFinal() {
    setLoading(true)
    try {
      // Inclure les scènes pré-générées pour éviter de re-générer images + clips en backend.
      // IMPORTANT: le backend rejette la requête (400) si script vide ET pre_generated_scenes vide.
      // On s'assure qu'au moins l'un des deux est toujours non-vide avant d'appeler l'API.
      const preGeneratedScenes = project.scenes.length > 0
        ? project.scenes.map((s) => ({
            id: s.id,
            script_text: s.scriptText,
            image_url: s.imageUrl,
            clip_url: s.clipUrl,
            image_prompt: s.imagePrompt,
            animation_prompt: s.animationPrompt,
            // Incrustation texte optionnelle (drawtext ffmpeg) — ne pas
            // envoyer si vide pour préserver les scènes sans overlay.
            overlay_text: s.overlayText && s.overlayText.trim().length > 0
              ? s.overlayText.trim()
              : undefined,
          }))
        : undefined

      // Détecte les dialogues et assigne les voix
      const dialogue = detectDialogueInScript(project.script)
      let speakerVoices: Record<string, string> | undefined
      if (dialogue.hasDialogue) {
        // Assigner des voix alternées aux personnages
        const speakers = Array.from(dialogue.speakers).sort()
        speakerVoices = {}
        // Utiliser la voix sélectionnée pour le premier personnage, et une voix alternée pour les autres
        const defaultVoices = [
          project.voiceId || 'Adam',
          'Charlotte',
        ]
        for (let i = 0; i < speakers.length; i++) {
          speakerVoices[speakers[i]] = defaultVoices[i % 2]
        }
      }

      // En mode 'storyboard' (bypass animation), ne pas envoyer de pre_generated_scenes
      // avec clip_url vide — sinon le backend considère que les clips sont déjà prêts.
      // On envoie seulement images + textes ; Ken Burns s'applique côté backend.
      const sanitizedPreGenerated = project.animationMode === 'storyboard'
        ? preGeneratedScenes?.map((s) => ({ ...s, clip_url: undefined }))
        : preGeneratedScenes

      // Compute effective script: preserve order-of-preference but fall back to
      // joined scene text if the top-level script/description are both empty.
      // A non-undefined `script` is what prevents the backend 400 when scenes are
      // present but their scriptText is empty OR pre_generated_scenes ends up nil.
      const joinedSceneText = project.scenes.map((s) => s.scriptText || '').join(' ').trim()
      const rawScript = (project.script || project.description || joinedSceneText).trim()
      const effectiveScript = rawScript.length > 0 ? rawScript : undefined

      // Hard guard: if nothing would reach the backend, surface a clear error
      // instead of letting the server respond with the opaque 400.
      const hasPreGen = Array.isArray(sanitizedPreGenerated) && sanitizedPreGenerated.length > 0
      if (!effectiveScript && !hasPreGen) {
        toast.error('Aucun script ou scène à générer. Régénérez les scènes ou saisissez un script.')
        setLoading(false)
        return
      }

      // Debug payload — paste the console output if the 400 reappears.
      console.log('[goToFinal] payload', {
        scriptLen: effectiveScript?.length ?? 0,
        sceneCount: sanitizedPreGenerated?.length ?? 0,
        animationMode: project.animationMode,
        inputType: project.inputType,
      })

      const { video_id, script_condensed } = await startFacelessGeneration({
        title: project.title || 'Faceless video',
        style: project.style ?? 'cinematique',
        input_type: project.inputType,
        format: project.format,
        duration: project.duration,
        script: effectiveScript,
        voice_id: project.voiceId || undefined,
        pre_generated_scenes: sanitizedPreGenerated,
        dialogue_mode: dialogue.hasDialogue,
        speaker_voices: speakerVoices,
        animation_mode: project.animationMode ?? 'fast',
      })

      // Display condensation warning if script was auto-condensed
      if (script_condensed?.condensed) {
        toast.info(
          `Script condensé: ${script_condensed.originalWordCount ?? '?'} → ${script_condensed.condensedWordCount ?? '?'} mots (−${Math.abs((script_condensed.condensedWordCount ?? 0) - (script_condensed.originalWordCount ?? 0))} mots)`,
          { duration: 5000 }
        )
      }

      patch({ videoId: video_id, step: 'final' })
      onGenerated(project.title || project.script.slice(0, 60) || 'New video', video_id)
      // Persist active generation to localStorage so a page refresh can reconnect
      try {
        localStorage.setItem(ACTIVE_GEN_KEY, JSON.stringify({
          videoId: video_id,
          title: project.title || project.script.slice(0, 60) || 'New video',
          startedAt: Date.now(),
        }))
      } catch { /* storage quota — non-blocking */ }
      // Stamp the URL so a refresh lands back on the final step
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', `/faceless/hub?resume=${video_id}`)
      }
      // Pipeline row now owns this project — remove the draft row so
      // it no longer appears in /drafts or the DraftsSection of /projects.
      await clearDraft().catch(() => null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[goToFinal] Pipeline start failed:', msg, err)
      // Si session expirée → message explicite pour que l'utilisateur se reconnecte
      if (msg.includes('Session expired') || msg.includes('reconnecter')) {
        toast.error('Session expirée — reconnecte-toi puis relance la génération')
      } else {
        toast.error(`La génération a échoué : ${msg}`)
      }
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Loader2 size={32} className="text-blue-500 animate-spin" />
        <p className="font-display text-base font-semibold text-foreground">Découpage du script en scènes…</p>
        <p className="font-body text-sm text-[--text-muted]">L'IA analyse ton script et génère les prompts visuels.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Banner: background generation detected via localStorage (no ?resume param in URL) */}
      {bgGen && project.step !== 'final' && (
        <div className="flex items-center gap-3 px-4 py-3 bg-blue-500/10 border-b border-blue-500/20 shrink-0">
          <Loader2 size={14} className="text-blue-500 animate-spin shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-body text-sm font-medium text-foreground">Votre vidéo tourne en arrière-plan</p>
            <p className="font-mono text-xs text-[--text-muted] truncate">{bgGen.title}</p>
          </div>
          <button
            type="button"
            onClick={() => { patch({ videoId: bgGen.videoId, step: 'final' }); setBgGen(null) }}
            className="font-body text-xs text-blue-500 font-semibold hover:underline whitespace-nowrap"
          >
            Voir le progrès →
          </button>
          <button
            type="button"
            onClick={() => { setBgGen(null); try { localStorage.removeItem(ACTIVE_GEN_KEY) } catch { /* ignore */ } }}
            className="text-[--text-muted] hover:text-foreground transition-colors ml-1"
            aria-label="Fermer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <StepIndicator current={project.step} savedState={savedState} />

      <div className="flex-1 overflow-y-auto">
        {project.step === 'setup' && (
          <SetupStep
            project={project}
            onChange={patch}
            onNext={goToStoryboard}
            loading={loading}
          />
        )}
        {project.step === 'storyboard' && (
          <StoryboardStep
            scenes={project.scenes}
            onScenesChange={handleScenesChange}
            onBack={() => patch({ step: 'setup' })}
            onNext={goToImages}
          />
        )}
        {project.step === 'images' && (
          <ImagesStep
            scenes={project.scenes}
            style={project.style ?? 'cinematique'}
            masterSeed={project.masterSeed}
            styleReference={project.styleReference}
            onScenesChange={handleScenesChange}
            onBack={() => patch({ step: 'storyboard' })}
            onNext={goToClips}
          />
        )}
        {project.step === 'clips' && (
          <ClipsStep
            scenes={project.scenes}
            onScenesChange={handleScenesChange}
            voiceId={project.voiceId}
            videoId={project.videoId}
            style={project.style ?? undefined}
            animationMode={project.animationMode ?? 'fast'}
            onAnimationModeChange={(mode) => patch({ animationMode: mode })}
            onBack={() => patch({ step: 'images' })}
            onNext={goToFinal}
            onReassembled={() => {
              // Pas d'URL en réponse de l'API (assemblage en arrière-plan) :
              // FinalStep résout la vidéo via useVideoStatus quand le backend
              // passe la ligne `videos` en status='done' avec output_url.
              patch({ step: 'final' })
            }}
          />
        )}
        {project.step === 'final' && (
          <FinalStep
            project={project}
            onNew={() => {
              setProject(DEFAULT_PROJECT)
              setBgGen(null)
              try { localStorage.removeItem(ACTIVE_GEN_KEY) } catch { /* ignore */ }
              if (typeof window !== 'undefined') window.history.replaceState(null, '', '/faceless/hub')
            }}
            onRetry={goToFinal}
            onVideoReady={onVideoReady}
            onEditScenes={project.videoId ? () => patch({ step: 'clips' }) : undefined}
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

export function FacelessHub({ initialVideos, initialDraft, resumeVideoId }: {
  initialVideos: VideoSession[]
  initialDraft?: InitialHubDraft | null
  resumeVideoId?: string | null
}) {
  const { t } = useLanguage()
  const [sessions, setSessions] = useState<VideoSession[]>(initialVideos)
  const [viewId,   setViewId]   = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  const viewSession = sessions.find((s) => s.id === viewId) ?? null

  async function handleSessionDownload(session: VideoSession) {
    // IDs locaux (local-timestamp) = session pas encore en DB, pas de URL disponible
    if (!session.output_url && session.id.startsWith('local-')) {
      toast.error('La vidéo est en cours de sauvegarde — réessaie dans quelques secondes')
      return
    }
    setDownloading(true)
    try {
      // Toujours utiliser la route proxy (évite CORS sur Supabase CDN)
      const res = await fetch(`/api/download-video?id=${session.id}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `${session.title ?? 'video'}.mp4`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
    } catch {
      toast.error(t('fh_downloadError'))
    } finally {
      setDownloading(false)
    }
  }

  function handleGenerated(title: string, videoId: string) {
    // Ajoute la session dans la sidebar avec le vrai videoId
    // Ne change PAS viewId : l'utilisateur reste dans FinalStep pour voir la progression
    setSessions((prev) => [
      { id: videoId, title, status: 'processing', created_at: new Date().toISOString() },
      ...prev.filter((s) => s.id !== videoId),
    ])
  }

  function handleVideoReady(videoId: string, outputUrl: string) {
    // Clear localStorage active generation + clean up URL
    try { localStorage.removeItem(ACTIVE_GEN_KEY) } catch { /* ignore */ }
    if (typeof window !== 'undefined') window.history.replaceState(null, '', '/faceless/hub')
    // Met à jour la session avec l'URL de la vidéo une fois terminée
    setSessions((prev) =>
      prev.map((s) => s.id === videoId ? { ...s, status: 'done', output_url: outputUrl } : s)
    )
  }

  return (
    <div className="flex flex-1 h-full overflow-hidden">

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside className="glass glass-border-r w-52 m-3 mr-0 rounded-2xl flex flex-col shrink-0 overflow-hidden">
        <div className="p-4 glass-border-b flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-foreground">Faceless Video</h2>
          <Wand2 size={14} className="text-[--text-muted]" />
        </div>

        <div className="p-3 glass-border-b">
          <button type="button" onClick={() => setViewId(null)}
            className="flex items-center gap-2 w-full bg-white/40 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm font-body text-foreground hover:bg-blue-500/10 hover:border-blue-500/40 transition-all">
            <Plus size={15} className="text-blue-500" />
            {t('fh_newVideo')}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
              <Video size={26} className="text-[--text-muted] mb-2" />
              <p className="text-[--text-muted] font-body text-xs">Aucune vidéo.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {sessions.map((s) => (
                <button key={s.id} type="button" onClick={() => setViewId(s.id)}
                  title={s.title ?? t('fh_untitled')}
                  className={cn('w-full text-left px-3 py-2.5 rounded-xl transition-all',
                    viewId === s.id ? 'bg-blue-500/15 border border-blue-500/30' : 'hover:bg-white/40 dark:hover:bg-white/5')}>
                  <p className="font-body text-xs text-foreground truncate">{s.title ?? t('fh_untitled')}</p>
                  <span className="font-mono text-[11px] text-[--text-muted]">
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
                <h2 className="font-display text-lg font-bold text-foreground">{viewSession.title ?? 'Video'}</h2>
                <button type="button" onClick={() => setViewId(null)} className="text-xs font-mono text-blue-500 hover:underline">+ {t('fh_newVideo')}</button>
              </div>
              {viewSession.output_url
                ? <VideoPlayer url={viewSession.output_url} title={viewSession.title ?? undefined} />
                : (
                  <div className={cn('w-full rounded-2xl aspect-video bg-gradient-to-br', SCENE_COLORS[0], 'flex items-center justify-center')}>
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                        <Play size={18} className="text-white fill-white" />
                      </div>
                      <p className="font-mono text-[11px] text-white/60 uppercase tracking-wider">Vidéo générée</p>
                    </div>
                  </div>
                )
              }
              <button
                type="button"
                onClick={() => handleSessionDownload(viewSession)}
                disabled={downloading}
                className="mt-4 flex items-center justify-center gap-2 w-full px-5 py-2.5 rounded-xl bg-gray-900 text-white font-display font-semibold text-sm hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download size={15} /> {downloading ? t('fh_downloading') : t('fh_download')}
              </button>
            </div>
          </div>
        ) : (
          <FacelessPipeline onGenerated={handleGenerated} onVideoReady={handleVideoReady} initialDraft={initialDraft ?? null} resumeVideoId={resumeVideoId ?? null} />
        )}
      </div>
    </div>
  )
}
