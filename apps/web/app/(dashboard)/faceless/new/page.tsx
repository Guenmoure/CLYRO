'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useDraftSave } from '@/hooks/use-draft-save'
import { createBrowserClient } from '@/lib/supabase'
import { Mic, MicOff, Volume2, AlertTriangle, ShoppingCart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WizardLayout } from '@/components/creation/WizardLayout'
import { GenerationOverlay, type GenerationStage } from '@/components/creation/GenerationOverlay'
import { StyleCarousel, type StyleConfig } from '@/components/creation/StyleCarousel'
import { VoicePickerModal, type ClyroVoice } from '@/components/creation/VoicePickerModal'
import { ResultModal } from '@/components/creation/ResultModal'
import AnimationModeSelector from '@/components/creation/AnimationModeSelector'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  startFacelessGeneration,
  getPublicVoices,
  subscribeToVideoStatus,
} from '@/lib/api'
import type { FacelessStyle, VideoFormat, VideoDuration, AnimationMode } from '@clyro/shared'
import { ANIMATION_MODES } from '@clyro/shared'

// ── Constants ──────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 'script',    label: 'Script' },
  { id: 'style',     label: 'Style & Voice' },
  { id: 'animation', label: 'Animation' },
  { id: 'format',    label: 'Format' },
  { id: 'options',   label: 'Options' },
  { id: 'review',    label: 'Finalization' },
]

const GENERATION_STAGES: GenerationStage[] = [
  { main: 'Analyzing script…',     sub: 'AI breaks down your content into scenes' },
  { main: 'Generating images…', sub: 'Creating visuals for each scene' },
  { main: 'Text-to-speech…',       sub: 'Recording the narration' },
  { main: 'Animating…',             sub: 'Applying effects and transitions' },
  { main: 'Final assembly…',      sub: 'Editing and rendering the video' },
]

const FACELESS_STYLES: StyleConfig[] = [
  { id: 'cinematique',      name: 'Cinematic',      description: 'Epic shots and dramatic staging', pro: false },
  { id: 'stock-vo',         name: 'Stock + Voice',        description: 'Stock footage with professional narration', pro: false },
  { id: 'whiteboard',       name: 'Whiteboard',        description: 'Whiteboard animation, explainer style', pro: false },
  { id: 'stickman',         name: 'Stickman',          description: 'Humorous stick figure animation', pro: false },
  { id: 'flat-design',      name: 'Flat Design',       description: 'Minimalist vector illustrations', pro: true },
  { id: '3d-pixar',         name: '3D Pixar',          description: '3D rendering animation style', pro: true },
  { id: 'minimaliste',      name: 'Minimalist',       description: 'Text on clean background, very polished', pro: false },
  { id: 'infographie',      name: 'Infographics',       description: 'Animated charts, data and diagrams', pro: true },
  { id: 'motion-graphics',  name: 'Motion Graphics',   description: 'Modern typographic animations', pro: true },
  { id: 'animation-2d',     name: '2D Animation',      description: 'Cartoon-style animated characters', pro: true },
]

const FORMAT_OPTIONS: { value: VideoFormat; label: string; desc: string }[] = [
  { value: '9:16', label: 'Vertical',    desc: 'TikTok, Reels, Shorts' },
  { value: '1:1',  label: 'Square',       desc: 'Instagram, Twitter' },
  { value: '16:9', label: 'Landscape',     desc: 'YouTube, LinkedIn' },
]

const DURATION_OPTIONS: { value: VideoDuration; label: string }[] = [
  { value: '15s', label: '15 sec' },
  { value: '30s', label: '30 sec' },
  { value: '60s', label: '1 min' },
]

const CONTEXTUAL_HELP: string[] = [
  'Write or paste your script. AI will automatically break it down into scenes.',
  'Choose the visual style of your video. Hover over cards to preview.',
  'Choose how your images will be animated. You can refine scene by scene later.',
  'Format determines your video ratio and narration duration.',
  'Advanced options to customize your video further.',
  'Review everything before launching generation.',
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
      <SectionTitle>Your script</SectionTitle>
      <SectionSub>Paste or write the text you want to transform into a video.</SectionSub>

      <textarea
        value={script}
        onChange={e => onChange(e.target.value)}
        rows={14}
        placeholder="Ex: Today, we're talking about the AI revolution in digital marketing..."
        className="w-full bg-muted border border-border rounded-xl px-4 py-3 font-body text-sm text-foreground placeholder-[--text-muted] resize-none focus:outline-none focus:border-blue-500/60 transition-colors"
      />
      <div className="flex items-center justify-between">
        <p className="font-mono text-xs text-[--text-muted]">
          {wordCount} words · ~{Math.round(wordCount / 130)} min narration
        </p>
        {wordCount > 600 && (
          <Badge variant="warning">Long script — will be condensed</Badge>
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
  userPlan: 'free' | 'starter' | 'pro' | 'creator' | 'studio'
}) {
  return (
    <div className="space-y-8">
      <div>
        <SectionTitle>Visual style</SectionTitle>
        <SectionSub>Choose your video aesthetic. Hover to see preview.</SectionSub>
        <StyleCarousel
          styles={FACELESS_STYLES}
          selected={selectedStyle}
          onChange={(id) => onStyleChange(id as FacelessStyle)}
          userPlan={userPlan}
        />
      </div>

      <div>
        <SectionTitle>Voice</SectionTitle>
        <SectionSub>Select the voice that will narrate your video.</SectionSub>
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
              <p className="font-body text-sm text-[--text-muted]">No voice selected — click to choose</p>
            )}
          </div>
          <Badge variant="neutral">Change</Badge>
        </button>
      </div>
    </div>
  )
}

// ── Step 2 — Animation Mode ────────────────────────────────────────────────────

function StepAnimation({
  animationMode,
  onModeChange,
  userPlan,
  wordCount,
  creditsBalance,
}: {
  animationMode: AnimationMode
  onModeChange:  (m: AnimationMode) => void
  userPlan:      'free' | 'starter' | 'pro' | 'creator' | 'studio'
  wordCount:     number
  creditsBalance: number
}) {
  const durationMin      = Math.max(1, Math.ceil(wordCount / 150))
  const config           = ANIMATION_MODES[animationMode]
  const estimatedCredits = Math.ceil(durationMin * config.creditsPerMin)
  const scenesEstimate   = Math.max(3, Math.round(wordCount / 60))
  const insufficient     = creditsBalance < estimatedCredits

  return (
    <div className="space-y-6">
      <div className="text-center">
        <SectionTitle>Animation mode</SectionTitle>
        <SectionSub>
          Choose how your images will be animated.
          You can adjust scene by scene in the next step.
        </SectionSub>
      </div>

      <AnimationModeSelector
        value={animationMode}
        onChange={onModeChange}
        userPlan={userPlan}
        scriptDurationMin={durationMin}
      />

      {/* Credit estimate card */}
      <div className="rounded-2xl border border-border bg-muted p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-display text-sm text-foreground">Estimate for this video</p>
            <p className="font-body text-xs text-[--text-muted] mt-0.5">
              ~{durationMin} min · {scenesEstimate} scenes · {config.label} mode
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-display text-xl bg-grad-primary bg-clip-text text-transparent">
              ~{estimatedCredits} cr
            </p>
            <p className="font-mono text-xs text-[--text-muted] mt-0.5">
              Balance: {creditsBalance} cr
            </p>
          </div>
        </div>

        {insufficient && (
          <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-3">
            <AlertTriangle size={14} className="text-warning shrink-0" />
            <p className="font-body text-xs text-[--text-muted] flex-1">
              Insufficient balance for this mode. Buy credits or switch to Storyboard mode.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 gap-1.5"
              onClick={() => window.open('/settings/billing', '_blank')}
            >
              <ShoppingCart size={12} />
              Credits
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Step 3 — Format ────────────────────────────────────────────────────────────

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
        <SectionSub>Your video ratio determines where it will be distributed.</SectionSub>
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
        <SectionTitle>Target duration</SectionTitle>
        <SectionSub>Narration will be adapted to this duration.</SectionSub>
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

// ── Step 4 — Options ───────────────────────────────────────────────────────────

function StepOptions({
  dialogueMode,
  onDialogueModeChange,
}: {
  dialogueMode: boolean
  onDialogueModeChange: (v: boolean) => void
}) {
  return (
    <div className="space-y-6">
      <SectionTitle>Advanced options</SectionTitle>
      <SectionSub>Customize the generation behavior.</SectionSub>

      <div className="flex items-center justify-between rounded-xl bg-muted border border-border px-4 py-4">
        <div className="flex items-center gap-3">
          {dialogueMode ? (
            <Mic size={18} className="text-blue-400" />
          ) : (
            <MicOff size={18} className="text-[--text-muted]" />
          )}
          <div>
            <p className="font-display text-sm text-foreground">Dialogue mode</p>
            <p className="font-body text-xs text-[--text-muted]">
              AI detects characters and assigns different voices to each
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
          title={dialogueMode ? 'Disable dialogue mode' : 'Enable dialogue mode'}
          aria-checked={dialogueMode}
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

// ── Step 5 — Review ────────────────────────────────────────────────────────────

function StepReview({
  title,
  script,
  style,
  voice,
  animationMode,
  format,
  duration,
  dialogueMode,
}: {
  title: string
  script: string
  style: FacelessStyle
  voice?: ClyroVoice
  animationMode: AnimationMode
  format: VideoFormat
  duration: VideoDuration
  dialogueMode: boolean
}) {
  const wordCount  = script.trim().split(/\s+/).filter(Boolean).length
  const styleConfig = FACELESS_STYLES.find(s => s.id === style)
  const animConfig  = ANIMATION_MODES[animationMode]

  const rows: [string, string][] = [
    ['Title',        title || '—'],
    ['Script',       `${wordCount} words`],
    ['Style',        styleConfig?.name ?? style],
    ['Voice',         voice?.name ?? 'Not selected'],
    ['Animation',    `${animConfig.label} · ${animConfig.generationTime}`],
    ['Format',       format],
    ['Duration',        duration],
    ['Dialogue mode',dialogueMode ? 'Enabled' : 'Disabled'],
  ]

  return (
    <div className="space-y-4">
      <SectionTitle>Summary</SectionTitle>
      <SectionSub>Review your settings before launching generation.</SectionSub>

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

      {animationMode !== 'storyboard' && (
        <div className="flex items-start gap-3 rounded-xl bg-blue-500/5 border border-blue-500/20 px-4 py-3">
          <span className="font-mono text-[11px] text-blue-400 mt-0.5">ℹ</span>
          <p className="font-body text-xs text-[--text-muted]">
            <strong className="text-foreground">{animConfig.label}</strong> mode — clips
            will be generated after images ({animConfig.generationTime} additional).
          </p>
        </div>
      )}

      <p className="font-body text-xs text-[--text-muted] text-center mt-4">
        Generation typically takes 2 to 15 minutes depending on mode and script length.
      </p>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function FacelessNewPage() {
  const router      = useRouter()
  const params      = useSearchParams()
  const draftParam  = params.get('draft')

  const [currentStep,    setCurrentStep]    = useState(0)
  const [projectName,    setProjectName]    = useState('New Faceless project')
  const [script,         setScript]         = useState('')
  const [style,          setStyle]          = useState<FacelessStyle>('cinematique')
  const [selectedVoice,  setSelectedVoice]  = useState<ClyroVoice | undefined>()
  const [animationMode,  setAnimationMode]  = useState<AnimationMode>('storyboard')
  const [format,         setFormat]         = useState<VideoFormat>('9:16')
  const [duration,       setDuration]       = useState<VideoDuration>('30s')
  const [dialogueMode,   setDialogueMode]   = useState(false)

  // Restore draft from DB on mount when ?draft=<id> is present
  useEffect(() => {
    if (!draftParam) return
    const supabase = createBrowserClient()
    supabase
      .from('videos')
      .select('title, wizard_step, wizard_state')
      .eq('id', draftParam)
      .eq('status', 'draft')
      .single()
      .then(({ data }: { data: any }) => {
        if (!data) return
        if (data.title) setProjectName(data.title)
        if (typeof data.wizard_step === 'number') setCurrentStep(data.wizard_step - 1)
        const s = (data.wizard_state ?? {}) as Record<string, unknown>
        if (s.script)        setScript(s.script as string)
        if (s.style)         setStyle(s.style as FacelessStyle)
        if (s.selectedVoice) setSelectedVoice(s.selectedVoice as ClyroVoice)
        if (s.animationMode) setAnimationMode(s.animationMode as AnimationMode)
        if (s.format)        setFormat(s.format as VideoFormat)
        if (s.duration)      setDuration(s.duration as VideoDuration)
        if (typeof s.dialogueMode === 'boolean') setDialogueMode(s.dialogueMode)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftParam])

  // DB-backed draft auto-save
  const { wasRestored, lastSaved, isSaving: draftIsSaving, clearDraft } = useDraftSave({
    module:      'faceless',
    title:       projectName,
    style:       style as string,
    currentStep,
    totalSteps:  STEPS.length,
    stepLabel:   STEPS[currentStep]?.label ?? '',
    state:       { script, style, selectedVoice, animationMode, format, duration, dialogueMode },
    initialDraftId: draftParam,
  })

  // User profile
  const [userPlan,        setUserPlan]        = useState<'free' | 'starter' | 'pro' | 'creator' | 'studio'>('free')
  const [creditsBalance,  setCreditsBalance]  = useState(0)

  // Voice picker
  const [voicePickerOpen, setVoicePickerOpen] = useState(false)
  const [libraryVoices,   setLibraryVoices]   = useState<ClyroVoice[]>([])
  const [voicesLoading,   setVoicesLoading]   = useState(false)

  // Generation
  const [generating,     setGenerating]     = useState(false)
  const [genStage,       setGenStage]       = useState(0)
  const [genProgress,    setGenProgress]    = useState(0)
  const [completedSteps, setCompletedSteps] = useState<string[]>([])

  const [resultVideoUrl, setResultVideoUrl] = useState<string | undefined>()
  const [resultOpen,     setResultOpen]     = useState(false)

  // Fetch user profile on mount
  useEffect(() => {
    const supabase = createBrowserClient()
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: any } }) => {
      if (!session) return
      supabase
        .from('profiles')
        .select('plan, credits_balance')
        .eq('id', session.user.id)
        .single()
        .then(({ data }: { data: any }) => {
          if (data) {
            setUserPlan((data.plan as typeof userPlan) ?? 'free')
            setCreditsBalance(data.credits_balance ?? 0)
          }
        })
    })
  }, [])

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

  const wordCount = script.trim().split(/\s+/).filter(Boolean).length
  const durationMin = Math.max(1, Math.ceil(wordCount / 150))
  const estimatedCredits = Math.ceil(durationMin * ANIMATION_MODES[animationMode].creditsPerMin)
  const creditInsufficient = creditsBalance < estimatedCredits

  const canNext = useCallback(() => {
    if (currentStep === 0) return script.trim().length > 20
    if (currentStep === 1) return !!selectedVoice
    if (currentStep === 2) return !creditInsufficient  // block on insufficient credits
    return true
  }, [currentStep, script, selectedVoice, creditInsufficient])

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
        animation_mode: animationMode,
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
        ;(window as Window & { _clyroEs?: EventSource })._clyroEs = es
      })

      const supabase2 = createBrowserClient()
      const { data: video } = await supabase2
        .from('videos')
        .select('output_url')
        .eq('id', result.video_id)
        .single()

      setResultVideoUrl(video?.output_url ?? undefined)
      setGenerating(false)
      clearDraft()
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
        currentPageLabel="New video"
        steps={STEPS}
        currentStep={currentStep}
        projectName={projectName}
        onProjectNameChange={setProjectName}
        contextualHelp={CONTEXTUAL_HELP[currentStep]}
        lastSaved={lastSaved}
        isSaving={draftIsSaving}
        draftWasRestored={wasRestored}
        onStepClick={setCurrentStep}
        canPrev={currentStep > 0}
        canNext={canNext()}
        onPrev={() => setCurrentStep(s => s - 1)}
        onNext={handleNext}
        nextLabel={isLastStep ? 'Launch generation' : 'Next'}
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
              userPlan={userPlan}
            />
          )}
          {currentStep === 2 && (
            <StepAnimation
              animationMode={animationMode}
              onModeChange={setAnimationMode}
              userPlan={userPlan}
              wordCount={wordCount}
              creditsBalance={creditsBalance}
            />
          )}
          {currentStep === 3 && (
            <StepFormat
              format={format}
              duration={duration}
              onFormatChange={setFormat}
              onDurationChange={setDuration}
            />
          )}
          {currentStep === 4 && (
            <StepOptions
              dialogueMode={dialogueMode}
              onDialogueModeChange={setDialogueMode}
            />
          )}
          {currentStep === 5 && (
            <StepReview
              title={projectName}
              script={script}
              style={style}
              voice={selectedVoice}
              animationMode={animationMode}
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
