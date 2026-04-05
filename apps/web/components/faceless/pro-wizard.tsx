'use client'

/**
 * ProWizard — Mode Pro de Faceless Video
 *
 * Steps :
 *   1. Niche       — Finance · Neurosciences · Psychologie · Dev. Personnel
 *   2. Style       — 4 styles adaptés à la niche (recommandé mis en avant)
 *   3. Contenu     — Titre + Script
 *   4. Voix        — Sélection voix ElevenLabs
 *   5. Storyboard  — Claude génère les scènes · l'utilisateur peut tout éditer
 *   6. Génération  — Pipeline SSE
 */

import { useState, useEffect, useCallback } from 'react'
import {
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Loader2,
  RefreshCw,
  Play,
  Mic2,
  Brain,
  TrendingUp,
  Heart,
  Zap,
  CheckCircle2,
  AlertCircle,
  Volume2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { startFacelessGeneration, getVoices, regenerateFacelessScene } from '@/lib/api'
import { useVideoStatus } from '@/hooks/use-video-status'
import { toast } from '@/components/ui/toast'
import type { FacelessStyle } from '@clyro/shared'

// ─────────────────────────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────────────────────────

type Niche = 'finance' | 'neurosciences' | 'psychologie' | 'developpement_personnel'

interface NicheDef {
  id: Niche
  label: string
  description: string
  icon: React.ElementType
  color: string
  recommended: FacelessStyle
  styles: FacelessStyle[]
}

const NICHES: NicheDef[] = [
  {
    id: 'finance',
    label: 'Finance Personnelle',
    description: 'Budget, investissement, épargne, liberté financière',
    icon: TrendingUp,
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    recommended: 'infographie',
    styles: ['infographie', 'whiteboard', 'minimaliste', 'animation-2d'],
  },
  {
    id: 'neurosciences',
    label: 'Neurosciences',
    description: 'Cerveau, mémoire, apprentissage, neurones',
    icon: Brain,
    color: 'text-violet-600 bg-violet-50 border-violet-200',
    recommended: 'animation-2d',
    styles: ['animation-2d', 'cinematique', 'infographie', 'minimaliste'],
  },
  {
    id: 'psychologie',
    label: 'Psychologie',
    description: 'Émotions, relations, comportement, bien-être mental',
    icon: Heart,
    color: 'text-rose-600 bg-rose-50 border-rose-200',
    recommended: 'minimaliste',
    styles: ['minimaliste', 'animation-2d', 'whiteboard', 'stock-vo'],
  },
  {
    id: 'developpement_personnel',
    label: 'Développement Personnel',
    description: 'Habitudes, discipline, motivation, productivité',
    icon: Zap,
    color: 'text-amber-600 bg-amber-50 border-amber-200',
    recommended: 'minimaliste',
    styles: ['minimaliste', 'whiteboard', 'animation-2d', 'infographie'],
  },
]

interface StyleDef {
  id: FacelessStyle
  emoji: string
  label: string
  desc: string
}

const ALL_STYLES: StyleDef[] = [
  { id: 'animation-2d',  emoji: '🎨', label: 'Animation 2D',   desc: 'Cartoon & illustration animée' },
  { id: 'stock-vo',      emoji: '🎬', label: 'Stock + VO',     desc: 'Vidéos stock avec voix off pro' },
  { id: 'minimaliste',   emoji: '⬜', label: 'Minimaliste',    desc: 'Texte animé sur fond épuré' },
  { id: 'infographie',   emoji: '📊', label: 'Infographie',    desc: 'Données et stats visuelles' },
  { id: 'whiteboard',    emoji: '✏️', label: 'Whiteboard',     desc: 'Dessin tableau blanc animé' },
  { id: 'cinematique',   emoji: '🎥', label: 'Cinématique',    desc: 'Ambiance cinéma dramatique' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ProScene {
  index: number
  texte_voix: string
  description_visuelle: string
  duree_estimee: number
  image_url?: string
}

interface VoiceItem {
  id: string
  name: string
  gender?: string
  accent?: string
  previewUrl?: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function StepHeader({
  step,
  total,
  title,
  subtitle,
}: {
  step: number
  total: number
  title: string
  subtitle?: string
}) {
  return (
    <div className="mb-6">
      <p className="text-xs text-brand-muted font-mono uppercase tracking-widest mb-1">
        Étape {step}/{total}
      </p>
      <h2 className="font-display text-xl font-bold text-brand-text">{title}</h2>
      {subtitle && <p className="text-sm text-brand-muted mt-0.5">{subtitle}</p>}
    </div>
  )
}

function NavButtons({
  onBack,
  onNext,
  nextLabel = 'Continuer',
  nextDisabled = false,
  loading = false,
}: {
  onBack?: () => void
  onNext: () => void
  nextLabel?: string
  nextDisabled?: boolean
  loading?: boolean
}) {
  return (
    <div className="flex items-center justify-between mt-8 pt-4 border-t border-brand-border">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-brand-muted hover:text-brand-text transition-colors"
        >
          <ChevronLeft size={16} />
          Retour
        </button>
      ) : (
        <div />
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled || loading}
        className="flex items-center gap-2 bg-brand-text text-white font-display font-semibold text-sm px-5 py-2.5 rounded-xl disabled:opacity-40 hover:opacity-80 transition-opacity"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : null}
        {nextLabel}
        {!loading && <ChevronRight size={14} />}
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1: Niche
// ─────────────────────────────────────────────────────────────────────────────

function StepNiche({
  value,
  onChange,
  onNext,
}: {
  value: Niche | null
  onChange: (n: Niche) => void
  onNext: () => void
}) {
  return (
    <div>
      <StepHeader step={1} total={5} title="Quelle est votre niche ?" subtitle="Cela adapte le ton et le style visuel recommandé." />
      <div className="grid grid-cols-1 gap-3">
        {NICHES.map((n) => {
          const Icon = n.icon
          const selected = value === n.id
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => onChange(n.id)}
              className={cn(
                'flex items-center gap-4 text-left p-4 rounded-xl border-2 transition-all',
                selected
                  ? 'border-brand-primary bg-brand-primary-light'
                  : 'border-brand-border bg-brand-surface hover:border-brand-primary/40'
              )}
            >
              <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border', n.color)}>
                <Icon size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold text-sm text-brand-text">{n.label}</p>
                <p className="text-xs text-brand-muted mt-0.5 truncate">{n.description}</p>
              </div>
              {selected && <CheckCircle2 size={18} className="text-brand-primary shrink-0" />}
            </button>
          )
        })}
      </div>
      <NavButtons onNext={onNext} nextDisabled={!value} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2: Style
// ─────────────────────────────────────────────────────────────────────────────

function StepStyle({
  niche,
  value,
  onChange,
  onBack,
  onNext,
}: {
  niche: Niche
  value: FacelessStyle | null
  onChange: (s: FacelessStyle) => void
  onBack: () => void
  onNext: () => void
}) {
  const nicheDef = NICHES.find((n) => n.id === niche)!
  const availableIds = nicheDef.styles
  const available = ALL_STYLES.filter((s) => availableIds.includes(s.id))

  return (
    <div>
      <StepHeader step={2} total={5} title="Choisissez un style visuel" subtitle={`Adapté à la niche "${nicheDef.label}"`} />
      <div className="grid grid-cols-2 gap-3">
        {available.map((s) => {
          const isRecommended = s.id === nicheDef.recommended
          const selected = value === s.id
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onChange(s.id)}
              className={cn(
                'relative flex flex-col gap-2 text-left p-3 rounded-xl border-2 transition-all',
                selected
                  ? 'border-brand-primary bg-brand-primary-light'
                  : 'border-brand-border bg-brand-surface hover:border-brand-primary/40'
              )}
            >
              {isRecommended && (
                <span className="absolute -top-2 right-2 bg-brand-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  Recommandé
                </span>
              )}
              <span className="text-2xl">{s.emoji}</span>
              <div>
                <p className="font-display font-semibold text-sm text-brand-text">{s.label}</p>
                <p className="text-xs text-brand-muted mt-0.5 leading-tight">{s.desc}</p>
              </div>
              {selected && (
                <CheckCircle2 size={14} className="absolute bottom-2 right-2 text-brand-primary" />
              )}
            </button>
          )
        })}
      </div>
      <NavButtons onBack={onBack} onNext={onNext} nextDisabled={!value} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3: Contenu
// ─────────────────────────────────────────────────────────────────────────────

function StepContent({
  title,
  script,
  onChangeTitle,
  onChangeScript,
  onBack,
  onNext,
}: {
  title: string
  script: string
  onChangeTitle: (v: string) => void
  onChangeScript: (v: string) => void
  onBack: () => void
  onNext: () => void
}) {
  const canNext = title.trim().length >= 3 && script.trim().length >= 50

  return (
    <div>
      <StepHeader step={3} total={5} title="Votre contenu" subtitle="Claude va découper votre script en scènes visuelles." />

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-body font-medium text-brand-text mb-1.5">
            Titre de la vidéo <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => onChangeTitle(e.target.value)}
            placeholder="Ex: La règle des 50/30/20 pour vos finances"
            className="w-full border border-brand-border rounded-xl px-3 py-2.5 text-sm font-body text-brand-text placeholder:text-brand-muted bg-brand-surface focus:outline-none focus:border-brand-primary focus:bg-white transition-colors"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-body font-medium text-brand-text">
              Script <span className="text-red-400">*</span>
            </label>
            <span className={cn('text-xs', script.length < 50 ? 'text-brand-muted' : 'text-emerald-600')}>
              {script.length}/50 min
            </span>
          </div>
          <textarea
            value={script}
            onChange={(e) => onChangeScript(e.target.value)}
            placeholder="Collez ou rédigez votre script ici. Claude le découpera en scènes cohérentes avec voix off et descriptions visuelles."
            rows={8}
            className="w-full border border-brand-border rounded-xl px-3 py-2.5 text-sm font-body text-brand-text placeholder:text-brand-muted bg-brand-surface focus:outline-none focus:border-brand-primary focus:bg-white transition-colors resize-none"
          />
        </div>
      </div>

      <NavButtons onBack={onBack} onNext={onNext} nextDisabled={!canNext} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 4: Voix
// ─────────────────────────────────────────────────────────────────────────────

function StepVoice({
  voiceId,
  voiceName,
  onSelect,
  onBack,
  onNext,
}: {
  voiceId: string
  voiceName: string
  onSelect: (id: string, name: string) => void
  onBack: () => void
  onNext: () => void
}) {
  const [voices, setVoices] = useState<VoiceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState<HTMLAudioElement | null>(null)

  useEffect(() => {
    getVoices()
      .then((r) => setVoices(r.public as VoiceItem[]))
      .catch(() => setVoices([]))
      .finally(() => setLoading(false))
  }, [])

  function playPreview(url: string | null | undefined) {
    if (!url) return
    preview?.pause()
    const audio = new Audio(url)
    audio.play()
    setPreview(audio)
  }

  return (
    <div>
      <StepHeader step={4} total={5} title="Choisissez une voix" subtitle="Voix off générée par ElevenLabs." />

      {/* No voice option */}
      <button
        type="button"
        onClick={() => onSelect('', 'Pas de voix off')}
        className={cn(
          'w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left mb-3 transition-all',
          voiceId === ''
            ? 'border-brand-primary bg-brand-primary-light'
            : 'border-brand-border bg-brand-surface hover:border-brand-primary/40'
        )}
      >
        <div className="w-8 h-8 rounded-full bg-brand-bg border border-brand-border flex items-center justify-center">
          <Mic2 size={14} className="text-brand-muted" />
        </div>
        <div>
          <p className="font-display font-semibold text-sm text-brand-text">Pas de voix off</p>
          <p className="text-xs text-brand-muted">Musique de fond uniquement</p>
        </div>
        {voiceId === '' && <CheckCircle2 size={16} className="ml-auto text-brand-primary" />}
      </button>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin text-brand-muted" />
        </div>
      ) : (
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {voices.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => onSelect(v.id, v.name)}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all',
                voiceId === v.id
                  ? 'border-brand-primary bg-brand-primary-light'
                  : 'border-brand-border bg-brand-surface hover:border-brand-primary/40'
              )}
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-primary/20 to-purple-200 flex items-center justify-center text-xs font-bold text-brand-primary shrink-0">
                {v.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold text-sm text-brand-text">{v.name}</p>
                <p className="text-xs text-brand-muted truncate">
                  {[v.gender, v.accent].filter(Boolean).join(' · ')}
                </p>
              </div>
              {'previewUrl' in v && v.previewUrl && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); playPreview(v.previewUrl) }}
                  className="p-1.5 rounded-lg hover:bg-brand-primary/10 text-brand-muted hover:text-brand-primary transition-colors"
                >
                  <Volume2 size={14} />
                </button>
              )}
              {voiceId === v.id && <CheckCircle2 size={16} className="text-brand-primary shrink-0" />}
            </button>
          ))}
        </div>
      )}

      <NavButtons onBack={onBack} onNext={onNext} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 5: Storyboard Editor
// ─────────────────────────────────────────────────────────────────────────────

function SceneCard({
  scene,
  videoId,
  onChange,
  onRegenerate,
}: {
  scene: ProScene
  videoId?: string
  onChange: (updated: Partial<ProScene>) => void
  onRegenerate?: (sceneIndex: number) => Promise<void>
}) {
  const [regenerating, setRegenerating] = useState(false)

  async function handleRegenerate() {
    if (!onRegenerate) return
    setRegenerating(true)
    try {
      await onRegenerate(scene.index)
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <div className="border border-brand-border rounded-xl bg-brand-surface overflow-hidden">
      {/* Scene header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-brand-border bg-brand-bg">
        <span className="text-xs font-mono font-semibold text-brand-muted uppercase tracking-widest">
          Scène {scene.index}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-brand-muted">{scene.duree_estimee}s</span>
          {onRegenerate && videoId && (
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={regenerating}
              className="flex items-center gap-1 text-xs text-brand-primary hover:text-brand-primary/80 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={11} className={cn(regenerating && 'animate-spin')} />
              {regenerating ? 'Génération…' : 'Regénérer'}
            </button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Voiceover */}
        <div>
          <label className="block text-xs font-body font-medium text-brand-muted mb-1">
            🎙 Voix off
          </label>
          <textarea
            value={scene.texte_voix}
            onChange={(e) => onChange({ texte_voix: e.target.value })}
            rows={2}
            className="w-full text-sm font-body text-brand-text bg-white border border-brand-border rounded-lg px-3 py-2 focus:outline-none focus:border-brand-primary transition-colors resize-none"
          />
        </div>

        {/* Visual prompt */}
        <div>
          <label className="block text-xs font-body font-medium text-brand-muted mb-1">
            🎨 Prompt visuel (anglais)
          </label>
          <textarea
            value={scene.description_visuelle}
            onChange={(e) => onChange({ description_visuelle: e.target.value })}
            rows={3}
            className="w-full text-xs font-mono text-brand-text bg-white border border-brand-border rounded-lg px-3 py-2 focus:outline-none focus:border-brand-primary transition-colors resize-none"
          />
        </div>
      </div>
    </div>
  )
}

function StepStoryboard({
  niche,
  style,
  title,
  script,
  scenes,
  onScenesChange,
  onBack,
  onNext,
}: {
  niche: Niche
  style: FacelessStyle
  title: string
  script: string
  scenes: ProScene[]
  onScenesChange: (scenes: ProScene[]) => void
  onBack: () => void
  onNext: () => void
}) {
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateStoryboard = useCallback(async () => {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/generate-storyboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche, style, title, script }),
      })
      const data = await res.json() as { scenes?: ProScene[]; error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? 'Erreur génération')
      onScenesChange(data.scenes ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setGenerating(false)
    }
  }, [niche, style, title, script, onScenesChange])

  // Auto-generate on first mount if no scenes yet
  useEffect(() => {
    if (scenes.length === 0) {
      generateStoryboard()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function updateScene(index: number, patch: Partial<ProScene>) {
    onScenesChange(
      scenes.map((s) => (s.index === index ? { ...s, ...patch } : s))
    )
  }

  return (
    <div>
      <StepHeader
        step={5}
        total={5}
        title="Votre storyboard"
        subtitle="Claude a découpé votre script. Modifiez librement chaque scène."
      />

      {/* Regenerate all button */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-brand-muted">
          {scenes.length > 0 ? `${scenes.length} scènes générées` : 'Génération en cours…'}
        </p>
        <button
          type="button"
          onClick={generateStoryboard}
          disabled={generating}
          className="flex items-center gap-1.5 text-xs text-brand-primary border border-brand-primary/30 rounded-lg px-3 py-1.5 hover:bg-brand-primary-light transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={cn(generating && 'animate-spin')} />
          Tout regénérer
        </button>
      </div>

      {/* Loading state */}
      {generating && scenes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="relative">
            <Sparkles size={28} className="text-brand-primary animate-pulse" />
          </div>
          <p className="text-sm text-brand-muted font-body">Claude génère votre storyboard…</p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-body font-medium text-red-600">{error}</p>
            <button
              type="button"
              onClick={generateStoryboard}
              className="text-xs text-red-500 underline mt-1"
            >
              Réessayer
            </button>
          </div>
        </div>
      )}

      {/* Scenes */}
      {scenes.length > 0 && (
        <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1 pb-1">
          {scenes.map((scene) => (
            <SceneCard
              key={scene.index}
              scene={scene}
              onChange={(patch) => updateScene(scene.index, patch)}
            />
          ))}
        </div>
      )}

      <NavButtons
        onBack={onBack}
        onNext={onNext}
        nextLabel="Lancer la génération"
        nextDisabled={scenes.length === 0 || generating}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 6: Generating (SSE tracking)
// ─────────────────────────────────────────────────────────────────────────────

const PIPELINE = [
  { key: 'storyboard', label: 'Storyboard IA',      pct: 20 },
  { key: 'visuals',    label: 'Génération visuels',  pct: 55 },
  { key: 'audio',      label: 'Voix off',            pct: 75 },
  { key: 'assembly',   label: 'Assemblage vidéo',    pct: 92 },
  { key: 'done',       label: 'Vidéo prête !',       pct: 100 },
]

function StepGenerating({
  videoId,
  title,
  onDone,
  onReset,
}: {
  videoId: string
  title: string
  onDone: (outputUrl: string | null) => void
  onReset: () => void
}) {
  const { status, progress, outputUrl, errorMessage, isDone, isError } = useVideoStatus(videoId)

  useEffect(() => {
    if (isDone) onDone(outputUrl)
  }, [isDone, outputUrl, onDone])

  const currentPipeline = PIPELINE.find((p) => p.key === status) ?? PIPELINE[0]

  return (
    <div className="flex flex-col items-center py-8 gap-6">
      <div className="w-12 h-12 rounded-full bg-brand-primary-light flex items-center justify-center">
        {isError ? (
          <AlertCircle size={22} className="text-red-500" />
        ) : isDone ? (
          <CheckCircle2 size={22} className="text-emerald-500" />
        ) : (
          <Loader2 size={22} className="animate-spin text-brand-primary" />
        )}
      </div>

      <div className="text-center">
        <h3 className="font-display font-bold text-lg text-brand-text">{title}</h3>
        <p className="text-sm text-brand-muted mt-1">
          {isError ? errorMessage : isDone ? 'Vidéo prête !' : currentPipeline.label}
        </p>
      </div>

      {/* Progress bar */}
      {!isError && (
        <div className="w-full max-w-xs">
          <div className="h-1.5 rounded-full bg-brand-border overflow-hidden">
            <div
              className="h-full bg-brand-primary rounded-full transition-all duration-700"
              style={{ width: `${isDone ? 100 : progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-2">
            {PIPELINE.map((p) => (
              <div key={p.key} className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    progress >= p.pct ? 'bg-brand-primary' : 'bg-brand-border'
                  )}
                />
                <span className="text-[9px] text-brand-muted text-center w-12 leading-tight hidden md:block">
                  {p.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isError && (
        <button
          type="button"
          onClick={onReset}
          className="text-sm text-brand-primary underline"
        >
          Recommencer
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main ProWizard
// ─────────────────────────────────────────────────────────────────────────────

type WizardStep = 'niche' | 'style' | 'content' | 'voice' | 'storyboard' | 'generating'

interface ProWizardState {
  niche: Niche | null
  style: FacelessStyle | null
  title: string
  script: string
  voiceId: string
  voiceName: string
  scenes: ProScene[]
}

export function ProWizard({
  onGenerated,
  onCancel,
}: {
  onGenerated: (videoId: string, title: string) => void
  onCancel: () => void
}) {
  const [step, setStep] = useState<WizardStep>('niche')
  const [videoId, setVideoId] = useState<string | null>(null)
  const [launching, setLaunching] = useState(false)

  const [state, setState] = useState<ProWizardState>({
    niche: null,
    style: null,
    title: '',
    script: '',
    voiceId: '',
    voiceName: 'Pas de voix off',
    scenes: [],
  })

  function patch(updates: Partial<ProWizardState>) {
    setState((prev) => ({ ...prev, ...updates }))
  }

  async function handleLaunch() {
    if (!state.niche || !state.style || !state.title || !state.script) return
    setLaunching(true)
    try {
      const res = await startFacelessGeneration({
        title: state.title,
        style: state.style,
        input_type: 'script',
        script: state.script,
        voice_id: state.voiceId || undefined,
      })
      setVideoId(res.video_id)
      setStep('generating')
      onGenerated(res.video_id, state.title)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur de lancement')
    } finally {
      setLaunching(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto">
      {/* Header band */}
      <div className="border-b border-brand-border px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-brand-primary" />
          <span className="font-display font-semibold text-sm text-brand-text">Mode Pro</span>
          <span className="text-[10px] font-mono uppercase tracking-wider bg-brand-primary text-white px-2 py-0.5 rounded-full">
            BETA
          </span>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-brand-muted hover:text-brand-text transition-colors"
        >
          Mode Standard
        </button>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 max-w-xl mx-auto w-full">
        {step === 'niche' && (
          <StepNiche
            value={state.niche}
            onChange={(n) => {
              patch({ niche: n, style: NICHES.find((x) => x.id === n)?.recommended ?? null })
            }}
            onNext={() => setStep('style')}
          />
        )}
        {step === 'style' && state.niche && (
          <StepStyle
            niche={state.niche}
            value={state.style}
            onChange={(s) => patch({ style: s })}
            onBack={() => setStep('niche')}
            onNext={() => setStep('content')}
          />
        )}
        {step === 'content' && (
          <StepContent
            title={state.title}
            script={state.script}
            onChangeTitle={(v) => patch({ title: v })}
            onChangeScript={(v) => patch({ script: v })}
            onBack={() => setStep('style')}
            onNext={() => setStep('voice')}
          />
        )}
        {step === 'voice' && (
          <StepVoice
            voiceId={state.voiceId}
            voiceName={state.voiceName}
            onSelect={(id, name) => patch({ voiceId: id, voiceName: name })}
            onBack={() => setStep('content')}
            onNext={() => setStep('storyboard')}
          />
        )}
        {step === 'storyboard' && state.niche && state.style && (
          <StepStoryboard
            niche={state.niche}
            style={state.style}
            title={state.title}
            script={state.script}
            scenes={state.scenes}
            onScenesChange={(s) => patch({ scenes: s })}
            onBack={() => setStep('voice')}
            onNext={handleLaunch}
          />
        )}
        {step === 'generating' && videoId && (
          <StepGenerating
            videoId={videoId}
            title={state.title}
            onDone={(url) => {
              // handled by parent via onGenerated callback
              void url
            }}
            onReset={() => {
              setVideoId(null)
              setStep('storyboard')
            }}
          />
        )}
      </div>
    </div>
  )
}
