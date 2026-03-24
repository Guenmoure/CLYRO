'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { startFacelessGeneration, getVoices } from '@/lib/api'
import { useVideoStatus } from '@/hooks/use-video-status'
import { toast } from '@/components/ui/toast'
import type { FacelessStyle } from '@clyro/shared'

// ── Types ──────────────────────────────────────────────────────────────────

interface WizardState {
  style: FacelessStyle | null
  inputType: 'script' | 'audio'
  title: string
  script: string
  voiceId: string
  voiceName: string
}

interface VoiceItem {
  id: string
  name: string
  gender?: string
  accent?: string
  useCase?: string
}

// ── Data ───────────────────────────────────────────────────────────────────

const STYLES: Array<{ id: FacelessStyle; emoji: string; label: string; desc: string }> = [
  { id: 'animation-2d', emoji: '🎨', label: 'Animation 2D', desc: 'Cartoon et illustration animée' },
  { id: 'stock-vo',     emoji: '🎬', label: 'Stock + VO',   desc: 'Vidéos stock avec voix off pro' },
  { id: 'minimaliste',  emoji: '⬜', label: 'Minimaliste',  desc: 'Texte animé sur fond épuré' },
  { id: 'infographie',  emoji: '📊', label: 'Infographie',  desc: 'Données et stats visuelles' },
  { id: 'whiteboard',   emoji: '✏️', label: 'Whiteboard',   desc: 'Dessin tableau blanc animé' },
  { id: 'cinematique',  emoji: '🎥', label: 'Cinématique',  desc: 'Ambiance cinéma dramatique' },
]

const PIPELINE_STEPS = [
  { key: 'storyboard', label: 'Storyboard IA',      progress: 25 },
  { key: 'visuals',    label: 'Génération visuels', progress: 60 },
  { key: 'audio',      label: 'Voix off',           progress: 75 },
  { key: 'assembly',   label: 'Assemblage vidéo',   progress: 90 },
  { key: 'done',       label: 'Vidéo prête !',      progress: 100 },
]

const STEP_LABELS = ['Style', 'Contenu', 'Voix', 'Confirmer']

// ── Step 1 — Style ─────────────────────────────────────────────────────────

function StepStyle({
  selected, onSelect, onNext,
}: {
  selected: FacelessStyle | null
  onSelect: (s: FacelessStyle) => void
  onNext: () => void
}) {
  return (
    <div>
      <h2 className="font-display text-lg font-semibold text-foreground mb-4">Choisis un style</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        {STYLES.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`bg-navy-800 border rounded-xl p-4 text-left transition-all ${
              selected === s.id
                ? 'border-clyro-blue bg-clyro-blue/5 ring-1 ring-clyro-blue/30'
                : 'border-border hover:border-clyro-blue/40'
            }`}
          >
            <span className="text-2xl mb-2 block">{s.emoji}</span>
            <p className="font-display font-semibold text-foreground text-sm">{s.label}</p>
            <p className="font-body text-xs text-muted-foreground mt-1">{s.desc}</p>
          </button>
        ))}
      </div>
      <button
        onClick={onNext}
        disabled={!selected}
        className="bg-grad-primary text-white font-display font-semibold px-6 py-2.5 rounded-xl disabled:opacity-40 hover:opacity-90 transition-opacity text-sm"
      >
        Suivant →
      </button>
    </div>
  )
}

// ── Step 2 — Script ────────────────────────────────────────────────────────

function StepScript({
  title, script, inputType, onUpdate, onNext, onBack,
}: {
  title: string
  script: string
  inputType: 'script' | 'audio'
  onUpdate: (field: 'title' | 'script' | 'inputType', value: string) => void
  onNext: () => void
  onBack: () => void
}) {
  const canContinue = title.trim().length > 0 && (inputType === 'audio' || script.trim().length >= 50)
  return (
    <div>
      <h2 className="font-display text-lg font-semibold text-foreground mb-4">Ton contenu</h2>
      <div className="mb-4">
        <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2 block">
          Titre de la vidéo
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => onUpdate('title', e.target.value)}
          placeholder="Ex : Comment apprendre à coder en 30 jours"
          maxLength={200}
          className="w-full bg-navy-800 border border-border rounded-xl px-4 py-3 text-foreground font-body text-sm placeholder:text-muted-foreground focus:outline-none focus:border-clyro-blue"
        />
      </div>
      <div className="flex gap-3 mb-4">
        {(['script', 'audio'] as const).map((t) => (
          <button
            key={t}
            onClick={() => onUpdate('inputType', t)}
            className={`flex-1 py-2.5 rounded-xl border font-display font-semibold text-sm transition-all ${
              inputType === t
                ? 'border-clyro-blue bg-clyro-blue/10 text-clyro-blue'
                : 'border-border bg-navy-800 text-muted-foreground hover:border-clyro-blue/40'
            }`}
          >
            {t === 'script' ? '📝 Écrire le script' : '🎙️ Importer audio'}
          </button>
        ))}
      </div>
      {inputType === 'script' ? (
        <div className="mb-4">
          <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2 block">
            Script ({script.length}/5000 — min 50 caractères)
          </label>
          <textarea
            value={script}
            onChange={(e) => onUpdate('script', e.target.value)}
            placeholder="Écris ton script ici. Claude AI va le découper en scènes et générer les visuels automatiquement..."
            maxLength={5000}
            rows={8}
            className="w-full bg-navy-800 border border-border rounded-xl px-4 py-3 text-foreground font-body text-sm placeholder:text-muted-foreground focus:outline-none focus:border-clyro-blue resize-none"
          />
        </div>
      ) : (
        <div className="mb-4 bg-navy-800 border border-dashed border-border rounded-xl p-8 text-center">
          <p className="text-muted-foreground font-body text-sm">
            Import audio via URL Supabase Storage — disponible prochainement.
          </p>
        </div>
      )}
      <div className="flex gap-3">
        <button onClick={onBack} className="font-display font-semibold px-4 py-2.5 rounded-xl border border-border text-muted-foreground hover:bg-navy-800 text-sm">
          ← Retour
        </button>
        <button
          onClick={onNext}
          disabled={!canContinue}
          className="bg-grad-primary text-white font-display font-semibold px-6 py-2.5 rounded-xl disabled:opacity-40 hover:opacity-90 transition-opacity text-sm"
        >
          Suivant →
        </button>
      </div>
    </div>
  )
}

// ── Step 3 — Voice ─────────────────────────────────────────────────────────

function StepVoice({
  selectedId, onSelect, onNext, onBack,
}: {
  selectedId: string
  onSelect: (id: string, name: string) => void
  onNext: () => void
  onBack: () => void
}) {
  const [voices, setVoices] = useState<VoiceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    getVoices()
      .then(({ public: pub }) => setVoices(pub as VoiceItem[]))
      .catch(() => toast.error('Impossible de charger les voix'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = voices.filter(
    (v) =>
      !search ||
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.gender?.toLowerCase().includes(search.toLowerCase()) ||
      v.accent?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <h2 className="font-display text-lg font-semibold text-foreground mb-4">Voix off</h2>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher une voix..."
        className="w-full bg-navy-800 border border-border rounded-xl px-4 py-3 text-foreground font-body text-sm placeholder:text-muted-foreground focus:outline-none focus:border-clyro-blue mb-4"
      />
      {loading ? (
        <div className="space-y-2 mb-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 bg-navy-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto mb-4 pr-1">
          <button
            onClick={() => onSelect('', 'Pas de voix off')}
            className={`w-full bg-navy-800 border rounded-xl px-4 py-3 text-left transition-all ${
              selectedId === '' ? 'border-clyro-blue bg-clyro-blue/5' : 'border-border hover:border-clyro-blue/40'
            }`}
          >
            <p className="font-display font-semibold text-sm text-foreground">🔇 Pas de voix off</p>
            <p className="font-mono text-xs text-muted-foreground">Musique de fond uniquement</p>
          </button>
          {filtered.map((v) => (
            <button
              key={v.id}
              onClick={() => onSelect(v.id, v.name)}
              className={`w-full bg-navy-800 border rounded-xl px-4 py-3 text-left transition-all ${
                selectedId === v.id ? 'border-clyro-blue bg-clyro-blue/5' : 'border-border hover:border-clyro-blue/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="font-display font-semibold text-sm text-foreground">{v.name}</p>
                <span className="font-mono text-xs text-muted-foreground">{v.gender} · {v.accent}</span>
              </div>
              {v.useCase && <p className="font-mono text-xs text-clyro-blue mt-0.5">{v.useCase}</p>}
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-3">
        <button onClick={onBack} className="font-display font-semibold px-4 py-2.5 rounded-xl border border-border text-muted-foreground hover:bg-navy-800 text-sm">
          ← Retour
        </button>
        <button onClick={onNext} className="bg-grad-primary text-white font-display font-semibold px-6 py-2.5 rounded-xl hover:opacity-90 transition-opacity text-sm">
          Suivant →
        </button>
      </div>
    </div>
  )
}

// ── Step 4 — Confirm ───────────────────────────────────────────────────────

function StepConfirm({
  state, onLaunch, onBack, launching,
}: {
  state: WizardState
  onLaunch: () => void
  onBack: () => void
  launching: boolean
}) {
  const styleLabel = STYLES.find((s) => s.id === state.style)?.label ?? state.style
  return (
    <div>
      <h2 className="font-display text-lg font-semibold text-foreground mb-4">Confirmer</h2>
      <div className="bg-navy-800 border border-border rounded-xl p-5 space-y-3 mb-5">
        <Row label="Titre"    value={state.title} />
        <Row label="Style"    value={styleLabel ?? ''} />
        <Row label="Type"     value={state.inputType === 'script' ? 'Script texte' : 'Import audio'} />
        {state.inputType === 'script' && <Row label="Script" value={`${state.script.length} caractères`} />}
        <Row label="Voix off" value={state.voiceName || 'Pas de voix off'} />
      </div>
      <p className="font-body text-sm text-muted-foreground mb-5">
        La génération prend 2–5 minutes. Tu recevras un email quand ta vidéo est prête.
      </p>
      <div className="flex gap-3">
        <button onClick={onBack} disabled={launching} className="font-display font-semibold px-4 py-2.5 rounded-xl border border-border text-muted-foreground hover:bg-navy-800 text-sm disabled:opacity-50">
          ← Retour
        </button>
        <button
          onClick={onLaunch}
          disabled={launching}
          className="bg-grad-primary text-white font-display font-semibold px-6 py-2.5 rounded-xl hover:opacity-90 transition-opacity text-sm disabled:opacity-60"
        >
          {launching ? 'Lancement...' : '🚀 Lancer la génération'}
        </button>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest shrink-0">{label}</span>
      <span className="font-body text-sm text-foreground text-right">{value}</span>
    </div>
  )
}

// ── Step 5 — Generating ────────────────────────────────────────────────────

function StepGenerating({ videoId, onReset }: { videoId: string; onReset: () => void }) {
  const router = useRouter()
  const { status, progress, outputUrl, errorMessage, isDone, isError } = useVideoStatus(videoId)

  useEffect(() => {
    if (isDone) {
      const t = setTimeout(() => router.push('/history'), 2500)
      return () => clearTimeout(t)
    }
  }, [isDone, router])

  return (
    <div>
      <h2 className="font-display text-lg font-semibold text-foreground mb-6">
        {isError ? '❌ Erreur de génération' : isDone ? '✅ Vidéo prête !' : '⏳ Génération en cours...'}
      </h2>
      <div className="h-2 bg-navy-800 rounded-full mb-6 overflow-hidden">
        <div
          className="h-full bg-grad-primary rounded-full transition-all duration-700"
          style={{ width: `${Math.max(progress, 5)}%` }}
        />
      </div>
      <div className="space-y-3 mb-6">
        {PIPELINE_STEPS.map((pStep) => {
          const isActive   = status === pStep.key
          const isComplete = progress >= pStep.progress
          return (
            <div key={pStep.key} className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-full border flex items-center justify-center text-xs font-mono transition-all ${
                isComplete
                  ? 'bg-clyro-blue border-clyro-blue text-white'
                  : isActive
                  ? 'border-clyro-blue text-clyro-blue'
                  : 'border-border text-muted-foreground'
              }`}>
                {isComplete ? '✓' : '·'}
              </div>
              <span className={`font-body text-sm ${isComplete ? 'text-foreground' : 'text-muted-foreground'}`}>
                {pStep.label}
              </span>
              {isActive && !isComplete && (
                <span className="font-mono text-xs text-clyro-blue animate-pulse">en cours</span>
              )}
            </div>
          )
        })}
      </div>
      {isError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4">
          <p className="text-red-400 text-sm font-body">{errorMessage ?? 'Une erreur est survenue.'}</p>
        </div>
      )}
      {isDone && outputUrl && (
        <a
          href={outputUrl}
          download
          className="inline-flex items-center gap-2 bg-clyro-blue/10 border border-clyro-blue/20 text-clyro-blue font-display font-semibold px-5 py-2.5 rounded-xl hover:bg-clyro-blue/20 text-sm transition-colors mb-3"
        >
          ↓ Télécharger la vidéo
        </a>
      )}
      {isDone && <p className="font-body text-sm text-muted-foreground mt-2">Redirection vers l&apos;historique...</p>}
      {isError && (
        <button onClick={onReset} className="font-display font-semibold px-5 py-2.5 rounded-xl border border-border text-foreground hover:bg-navy-800 text-sm mt-2">
          Recommencer
        </button>
      )}
    </div>
  )
}

// ── Main Wizard ────────────────────────────────────────────────────────────

export function FacelessWizard() {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1)
  const [launching, setLaunching] = useState(false)
  const [videoId, setVideoId] = useState<string | null>(null)
  const [state, setState] = useState<WizardState>({
    style: null,
    inputType: 'script',
    title: '',
    script: '',
    voiceId: '',
    voiceName: 'Pas de voix off',
  })

  function update<K extends keyof WizardState>(key: K, value: WizardState[K]) {
    setState((prev) => ({ ...prev, [key]: value }))
  }

  async function handleLaunch() {
    if (!state.style || !state.title.trim()) return
    setLaunching(true)
    try {
      const { video_id } = await startFacelessGeneration({
        title: state.title,
        style: state.style,
        input_type: state.inputType,
        script: state.inputType === 'script' ? state.script : undefined,
        voice_id: state.voiceId || undefined,
      })
      setVideoId(video_id)
      setStep(5)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors du lancement')
    } finally {
      setLaunching(false)
    }
  }

  function reset() {
    setStep(1)
    setVideoId(null)
    setState({ style: null, inputType: 'script', title: '', script: '', voiceId: '', voiceName: 'Pas de voix off' })
  }

  return (
    <div className="max-w-2xl">
      {step < 5 && (
        <div className="flex items-center gap-2 mb-8">
          {STEP_LABELS.map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full border font-mono text-xs flex items-center justify-center transition-all ${
                step > i + 1
                  ? 'bg-clyro-blue border-clyro-blue text-white'
                  : step === i + 1
                  ? 'border-clyro-blue text-clyro-blue bg-clyro-blue/10'
                  : 'border-border text-muted-foreground'
              }`}>
                {step > i + 1 ? '✓' : i + 1}
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div className={`h-px w-6 ${step > i + 1 ? 'bg-clyro-blue' : 'bg-border'}`} />
              )}
            </div>
          ))}
          <span className="font-mono text-xs text-muted-foreground ml-2">
            {STEP_LABELS[(step as number) - 1]}
          </span>
        </div>
      )}
      <div className="bg-navy-900 border border-border rounded-xl p-6">
        {step === 1 && (
          <StepStyle
            selected={state.style}
            onSelect={(s) => update('style', s)}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <StepScript
            title={state.title}
            script={state.script}
            inputType={state.inputType}
            onUpdate={(field, value) => {
              if (field === 'inputType') update('inputType', value as 'script' | 'audio')
              else update(field as 'title' | 'script', value)
            }}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <StepVoice
            selectedId={state.voiceId}
            onSelect={(id, name) => { update('voiceId', id); update('voiceName', name) }}
            onNext={() => setStep(4)}
            onBack={() => setStep(2)}
          />
        )}
        {step === 4 && (
          <StepConfirm
            state={state}
            onLaunch={handleLaunch}
            onBack={() => setStep(3)}
            launching={launching}
          />
        )}
        {step === 5 && videoId && <StepGenerating videoId={videoId} onReset={reset} />}
      </div>
    </div>
  )
}
