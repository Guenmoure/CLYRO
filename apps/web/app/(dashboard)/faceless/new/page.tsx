'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Mic, MicOff, Volume2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WizardLayout } from '@/components/creation/WizardLayout'
import { GenerationOverlay, type GenerationStage } from '@/components/creation/GenerationOverlay'
import { StyleCarousel, type StyleConfig } from '@/components/creation/StyleCarousel'
import { VoicePickerModal, type ClyroVoice } from '@/components/creation/VoicePickerModal'
import { ResultModal } from '@/components/creation/ResultModal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  startFacelessGeneration,
  getPublicVoices,
  subscribeToVideoStatus,
} from '@/lib/api'
import { createBrowserClient } from '@/lib/supabase'
import type { FacelessStyle, VideoFormat, VideoDuration } from '@clyro/shared'

// ── Constants ──────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 'script',  label: 'Script' },
  { id: 'style',   label: 'Style & Voix' },
  { id: 'format',  label: 'Format' },
  { id: 'options', label: 'Options' },
  { id: 'review',  label: 'Finalisation' },
]

const GENERATION_STAGES: GenerationStage[] = [
  { main: 'Analyse du script…',     sub: 'L\'IA décompose votre contenu en scènes' },
  { main: 'Génération des images…', sub: 'Création des visuels pour chaque scène' },
  { main: 'Synthèse vocale…',       sub: 'Enregistrement de la narration' },
  { main: 'Animation…',             sub: 'Application des effets et transitions' },
  { main: 'Assemblage final…',      sub: 'Montage et rendu de la vidéo' },
]

const FACELESS_STYLES: StyleConfig[] = [
  { id: 'cinematique',      name: 'Cinématique',      description: 'Plans épiques et mise en scène dramatique', pro: false },
  { id: 'stock-vo',         name: 'Stock + VO',        description: 'Images de stock avec voix-off professionnelle', pro: false },
  { id: 'whiteboard',       name: 'Whiteboard',        description: 'Animation tableau blanc, style explicatif', pro: false },
  { id: 'stickman',         name: 'Stickman',          description: 'Animation humoristique en personnages fil', pro: false },
  { id: 'flat-design',      name: 'Flat Design',       description: 'Illustrations vectorielles minimalistes', pro: true },
  { id: '3d-pixar',         name: '3D Pixar',          description: 'Rendu 3D style animation grand public', pro: true },
  { id: 'minimaliste',      name: 'Minimaliste',       description: 'Texte sur fond épuré, très propre', pro: false },
  { id: 'infographie',      name: 'Infographie',       description: 'Graphiques, données et schémas animés', pro: true },
  { id: 'motion-graphics',  name: 'Motion Graphics',   description: 'Animations typographiques modernes', pro: true },
  { id: 'animation-2d',     name: 'Animation 2D',      description: 'Personnages animés style cartoon', pro: true },
]

const FORMAT_OPTIONS: { value: VideoFormat; label: string; desc: string }[] = [
  { value: '9:16', label: 'Vertical',    desc: 'TikTok, Reels, Shorts' },
  { value: '1:1',  label: 'Carré',       desc: 'Instagram, Twitter' },
  { value: '16:9', label: 'Paysage',     desc: 'YouTube, LinkedIn' },
]

const DURATION_OPTIONS: { value: VideoDuration; label: string }[] = [
  { value: '15s', label: '15 sec' },
  { value: '30s', label: '30 sec' },
  { value: '60s', label: '1 min' },
]

const CONTEXTUAL_HELP: string[] = [
  'Écris ou colle ton script. L\'IA le découpera automatiquement en scènes.',
  'Choisis le style visuel de ta vidéo. Survole les cartes pour voir un aperçu.',
  'Le format détermine le ratio de ta vidéo et la durée de la narration.',
  'Options avancées pour personnaliser davantage ta vidéo.',
  'Vérifie tout avant de lancer la génération.',
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-xl text-foreground mb-1">{children}</h2>
}
function SectionSub({ children }: { children: React.ReactNode }) {
  return <p className="font-body text-sm text-[--text-muted] mb-6">{children}</p>
}

// ── Step 0 — Script ────────────────────────────────────────────────────────────

function StepScript({
  script,
  onChange,
}: {
  script: string
  onChange: (v: string) => void
}) {
  const wordCount = script.trim().split(/\s+/).filter(Boolean).length

  return (
    <div className="space-y-4">
      <SectionTitle>Ton script</SectionTitle>
      <SectionSub>Colle ou écris le texte que tu veux transformer en vidéo.</SectionSub>

      <textarea
        value={script}
        onChange={e => onChange(e.target.value)}
        rows={14}
        placeholder="Ex: Aujourd'hui, on parle de la révolution de l'IA dans le marketing digital..."
        className="w-full bg-muted border border-border rounded-xl px-4 py-3 font-body text-sm text-foreground placeholder-[--text-muted] resize-none focus:outline-none focus:border-blue-500/60 transition-colors"
      />
      <div className="flex items-center justify-between">
        <p className="font-mono text-xs text-[--text-muted]">
          {wordCount} mots · ~{Math.round(wordCount / 130)} min de narration
        </p>
        {wordCount > 600 && (
          <Badge variant="warning">Script long — sera condensé</Badge>
        )}
      </div>
    </div>
  )
}

// ── Step 1 — Style & Voice ─────────────────────────────────────────────────────

function StepStyleVoice({
  selectedStyle,
  onStyleChange,
  selectedVoice,
  onVoiceClick,
  userPlan,
}: {
  selectedStyle: FacelessStyle
  onStyleChange: (id: FacelessStyle) => void
  selectedVoice?: ClyroVoice
  onVoiceClick: () => void
  userPlan: 'free' | 'pro' | 'studio'
}) {
  return (
    <div className="space-y-8">
      <div>
        <SectionTitle>Style visuel</SectionTitle>
        <SectionSub>Choisis l&apos;esthétique de ta vidéo. Survole pour voir l&apos;aperçu.</SectionSub>
        <StyleCarousel
          styles={FACELESS_STYLES}
          selected={selectedStyle}
          onChange={(id) => onStyleChange(id as FacelessStyle)}
          userPlan={userPlan}
        />
      </div>

      <div>
        <SectionTitle>Voix</SectionTitle>
        <SectionSub>Sélectionne la voix qui narrera ta vidéo.</SectionSub>
        <button
          type="button"
          onClick={onVoiceClick}
          className={cn(
            'flex items-center gap-4 w-full rounded-xl px-4 py-3 border-2 transition-all duration-200',
            selectedVoice
              ? 'border-blue-500/40 bg-blue-500/5'
              : 'border-border bg-muted hover:border-border',
          )}
        >
          <div className="w-10 h-10 rounded-xl bg-border flex items-center justify-center shrink-0">
            {selectedVoice ? <Volume2 size={18} className="text-blue-400" /> : <Mic size={18} className="text-[--text-muted]" />}
          </div>
          <div className="flex-1 text-left">
            {selectedVoice ? (
              <>
                <p className="font-display text-sm text-foreground">{selectedVoice.name}</p>
                <p className="font-mono text-xs text-[--text-muted] capitalize">
                  {selectedVoice.gender} · {selectedVoice.language ?? selectedVoice.accent}
                </p>
              </>
            ) : (
              <p className="font-body text-sm text-[--text-muted]">Aucune voix sélectionnée — cliquer pour choisir</p>
            )}
          </div>
          <Badge variant="neutral">Changer</Badge>
        </button>
      </div>
    </div>
  )
}

// ── Step 2 — Format ────────────────────────────────────────────────────────────

function StepFormat({
  format,
  duration,
  onFormatChange,
  onDurationChange,
}: {
  format: VideoFormat
  duration: VideoDuration
  onFormatChange: (v: VideoFormat) => void
  onDurationChange: (v: VideoDuration) => void
}) {
  return (
    <div className="space-y-8">
      <div>
        <SectionTitle>Format</SectionTitle>
        <SectionSub>Le ratio de ta vidéo détermine où elle sera diffusée.</SectionSub>
        <div className="flex gap-4 flex-wrap">
          {FORMAT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onFormatChange(opt.value)}
              className={cn(
                'flex-1 min-w-[120px] flex flex-col items-center gap-3 rounded-xl p-4 border-2 transition-all duration-200',
                format === opt.value
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-border bg-muted hover:border-border',
              )}
            >
              {/* Aspect preview */}
              <div className={cn(
                'bg-border rounded-lg',
                opt.value === '9:16' && 'w-8 h-14',
                opt.value === '1:1'  && 'w-10 h-10',
                opt.value === '16:9' && 'w-14 h-8',
              )} />
              <div className="text-center">
                <p className="font-display text-sm text-foreground">{opt.label}</p>
                <p className="font-mono text-[11px] text-[--text-muted]">{opt.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <SectionTitle>Durée cible</SectionTitle>
        <SectionSub>La narration sera adaptée à cette durée.</SectionSub>
        <div className="flex gap-3 flex-wrap">
          {DURATION_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onDurationChange(opt.value)}
              className={cn(
                'px-6 py-3 rounded-xl border-2 font-display text-sm transition-all duration-200',
                duration === opt.value
                  ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                  : 'border-border bg-muted text-[--text-secondary] hover:border-border',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Step 3 — Options ───────────────────────────────────────────────────────────

function StepOptions({
  dialogueMode,
  onDialogueModeChange,
}: {
  dialogueMode: boolean
  onDialogueModeChange: (v: boolean) => void
}) {
  return (
    <div className="space-y-6">
      <SectionTitle>Options avancées</SectionTitle>
      <SectionSub>Personnalise le comportement de la génération.</SectionSub>

      {/* Dialogue mode toggle */}
      <div className="flex items-center justify-between rounded-xl bg-muted border border-border px-4 py-4">
        <div className="flex items-center gap-3">
          {dialogueMode ? (
            <Mic size={18} className="text-blue-400" />
          ) : (
            <MicOff size={18} className="text-[--text-muted]" />
          )}
          <div>
            <p className="font-display text-sm text-foreground">Mode dialogue</p>
            <p className="font-body text-xs text-[--text-muted]">
              L&apos;IA détecte les personnages et attribue des voix différentes à chacun
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onDialogueModeChange(!dialogueMode)}
          className={cn(
            'relative w-11 h-6 rounded-full transition-colors duration-200',
            dialogueMode ? 'bg-blue-500' : 'bg-border',
          )}
          role="switch"
          title={dialogueMode ? 'Désactiver le mode dialogue' : 'Activer le mode dialogue'}
          aria-checked={dialogueMode ? 'true' : 'false'}
        >
          <span className={cn(
            'absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200',
            dialogueMode ? 'translate-x-6' : 'translate-x-1',
          )} />
        </button>
      </div>
    </div>
  )
}

// ── Step 4 — Review ────────────────────────────────────────────────────────────

function StepReview({
  title,
  script,
  style,
  voice,
  format,
  duration,
  dialogueMode,
}: {
  title: string
  script: string
  style: FacelessStyle
  voice?: ClyroVoice
  format: VideoFormat
  duration: VideoDuration
  dialogueMode: boolean
}) {
  const wordCount = script.trim().split(/\s+/).filter(Boolean).length
  const styleConfig = FACELESS_STYLES.find(s => s.id === style)

  const rows: [string, string][] = [
    ['Titre',        title || '—'],
    ['Script',       `${wordCount} mots`],
    ['Style',        styleConfig?.name ?? style],
    ['Voix',         voice?.name ?? 'Non sélectionnée'],
    ['Format',       format],
    ['Durée',        duration],
    ['Mode dialogue',dialogueMode ? 'Activé' : 'Désactivé'],
  ]

  return (
    <div className="space-y-4">
      <SectionTitle>Récapitulatif</SectionTitle>
      <SectionSub>Vérifie tes paramètres avant de lancer la génération.</SectionSub>

      <div className="rounded-xl bg-muted border border-border overflow-hidden">
        {rows.map(([label, value], i) => (
          <div
            key={label}
            className={cn(
              'flex items-center justify-between px-4 py-3',
              i < rows.length - 1 && 'border-b border-border/50',
            )}
          >
            <span className="font-mono text-xs text-[--text-muted]">{label}</span>
            <span className="font-body text-sm text-foreground">{value}</span>
          </div>
        ))}
      </div>

      <p className="font-body text-xs text-[--text-muted] text-center mt-4">
        La génération prend généralement 2 à 5 minutes selon la longueur du script.
      </p>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function FacelessNewPage() {
  const router = useRouter()

  const [currentStep,    setCurrentStep]    = useState(0)
  const [projectName,    setProjectName]    = useState('Nouveau projet Faceless')
  const [lastSaved,      setLastSaved]      = useState<Date | null>(null)
  const [script,         setScript]         = useState('')
  const [style,          setStyle]          = useState<FacelessStyle>('cinematique')
  const [selectedVoice,  setSelectedVoice]  = useState<ClyroVoice | undefined>()
  const [format,         setFormat]         = useState<VideoFormat>('9:16')
  const [duration,       setDuration]       = useState<VideoDuration>('30s')
  const [dialogueMode,   setDialogueMode]   = useState(false)

  const [voicePickerOpen, setVoicePickerOpen] = useState(false)
  const [libraryVoices,   setLibraryVoices]   = useState<ClyroVoice[]>([])
  const [voicesLoading,   setVoicesLoading]   = useState(false)

  const [generating,     setGenerating]     = useState(false)
  const [genStage,       setGenStage]       = useState(0)
  const [genProgress,    setGenProgress]    = useState(0)
  const [completedSteps, setCompletedSteps] = useState<string[]>([])

  const [resultVideoUrl, setResultVideoUrl] = useState<string | undefined>()
  const [resultOpen,     setResultOpen]     = useState(false)

  // Load voices when voice picker opens
  async function handleOpenVoicePicker() {
    setVoicePickerOpen(true)
    if (libraryVoices.length > 0) return
    setVoicesLoading(true)
    try {
      const res = await getPublicVoices()
      setLibraryVoices(res.voices as ClyroVoice[])
    } catch {
      // silent
    } finally {
      setVoicesLoading(false)
    }
  }

  const canNext = useCallback(() => {
    if (currentStep === 0) return script.trim().length > 20
    if (currentStep === 1) return !!selectedVoice
    return true
  }, [currentStep, script, selectedVoice])

  function handleNext() {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(s => s + 1)
    } else {
      handleGenerate()
    }
  }

  async function handleGenerate() {
    setGenerating(true)
    setGenStage(0)
    setGenProgress(0)
    setCompletedSteps([])

    try {
      const result = await startFacelessGeneration({
        title: projectName,
        style,
        input_type: 'script',
        script,
        voice_id: selectedVoice?.id,
        format,
        duration,
        dialogue_mode: dialogueMode,
      })

      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''

      await new Promise<void>((resolve, reject) => {
        const es = subscribeToVideoStatus(result.video_id, token, (data) => {
          const p = data.progress ?? 0
          setGenProgress(p)
          const stageIndex = Math.min(Math.floor((p / 100) * GENERATION_STAGES.length), GENERATION_STAGES.length - 1)
          setGenStage(stageIndex)
          setCompletedSteps(prev => {
            const label = GENERATION_STAGES[stageIndex]?.main ?? ''
            return prev.includes(label) ? prev : [...prev, label]
          })
          if (data.status === 'done') {
            resolve()
          } else if (data.status === 'error') {
            reject(new Error('Génération échouée'))
          }
        })

        // Cleanup ref
        ;(window as Window & { _clyroEs?: EventSource })._clyroEs = es
      })

      // Fetch output_url
      const supabase2 = createBrowserClient()
      const { data: video } = await supabase2
        .from('videos')
        .select('output_url')
        .eq('id', result.video_id)
        .single()

      setResultVideoUrl(video?.output_url ?? undefined)
      setGenerating(false)
      setResultOpen(true)
    } catch {
      setGenerating(false)
    }
  }

  function handleCancel() {
    ;(window as Window & { _clyroEs?: EventSource })._clyroEs?.close()
    setGenerating(false)
    setGenProgress(0)
    setGenStage(0)
    setCompletedSteps([])
  }

  const isLastStep = currentStep === STEPS.length - 1

  return (
    <>
      <WizardLayout
        featureTitle="Faceless Videos"
        featureHref="/faceless"
        currentPageLabel="Nouvelle vidéo"
        steps={STEPS}
        currentStep={currentStep}
        projectName={projectName}
        onProjectNameChange={setProjectName}
        contextualHelp={CONTEXTUAL_HELP[currentStep]}
        lastSaved={lastSaved}
        onStepClick={setCurrentStep}
        onSave={() => setLastSaved(new Date())}
        canPrev={currentStep > 0}
        canNext={canNext()}
        onPrev={() => setCurrentStep(s => s - 1)}
        onNext={handleNext}
        nextLabel={isLastStep ? 'Lancer la génération' : 'Suivant'}
      >
        <div className="max-w-2xl mx-auto px-6 py-8">
          {currentStep === 0 && (
            <StepScript script={script} onChange={setScript} />
          )}
          {currentStep === 1 && (
            <StepStyleVoice
              selectedStyle={style}
              onStyleChange={setStyle}
              selectedVoice={selectedVoice}
              onVoiceClick={handleOpenVoicePicker}
              userPlan="free"
            />
          )}
          {currentStep === 2 && (
            <StepFormat
              format={format}
              duration={duration}
              onFormatChange={setFormat}
              onDurationChange={setDuration}
            />
          )}
          {currentStep === 3 && (
            <StepOptions
              dialogueMode={dialogueMode}
              onDialogueModeChange={setDialogueMode}
            />
          )}
          {currentStep === 4 && (
            <StepReview
              title={projectName}
              script={script}
              style={style}
              voice={selectedVoice}
              format={format}
              duration={duration}
              dialogueMode={dialogueMode}
            />
          )}
        </div>
      </WizardLayout>

      <VoicePickerModal
        isOpen={voicePickerOpen}
        onClose={() => setVoicePickerOpen(false)}
        selectedVoiceId={selectedVoice?.id}
        onSelect={v => { setSelectedVoice(v as ClyroVoice); setVoicePickerOpen(false) }}
        libraryVoices={libraryVoices as ClyroVoice[]}
        loading={voicesLoading}
      />

      <GenerationOverlay
        visible={generating}
        progress={genProgress}
        stages={GENERATION_STAGES}
        currentStage={genStage}
        completedSteps={completedSteps}
        onCancel={handleCancel}
      />

      <ResultModal
        isOpen={resultOpen}
        onClose={() => setResultOpen(false)}
        type="video"
        title={projectName}
        videoUrl={resultVideoUrl}
        onNewProject={() => { setResultOpen(false); router.push('/faceless/new') }}
      />
    </>
  )
}
