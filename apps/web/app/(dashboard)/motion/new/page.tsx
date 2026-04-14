'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Volume2, Mic, Music } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WizardLayout } from '@/components/creation/WizardLayout'
import { GenerationOverlay, type GenerationStage } from '@/components/creation/GenerationOverlay'
import { StyleCarousel, type StyleConfig } from '@/components/creation/StyleCarousel'
import { VoicePickerModal, type ClyroVoice } from '@/components/creation/VoicePickerModal'
import { ResultModal } from '@/components/creation/ResultModal'
import { Badge } from '@/components/ui/badge'
import {
  startMotionGeneration,
  getPublicVoices,
  subscribeToVideoStatus,
} from '@/lib/api'
import { createBrowserClient } from '@/lib/supabase'
import type { MotionStyle, VideoFormat, VideoDuration } from '@clyro/shared'

// ── Constants ──────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 'brief',  label: 'Brief' },
  { id: 'style',  label: 'Style & Format' },
  { id: 'brand',  label: 'Marque' },
  { id: 'voice',  label: 'Voix & Audio' },
  { id: 'review', label: 'Rendu' },
]

const GENERATION_STAGES: GenerationStage[] = [
  { main: 'Analyse du brief…',       sub: 'L\'IA structure votre message en scènes' },
  { main: 'Création du storyboard…', sub: 'Génération de la séquence narrative' },
  { main: 'Génération des assets…',  sub: 'Création des visuels de fond' },
  { main: 'Synthèse vocale…',        sub: 'Enregistrement de la narration' },
  { main: 'Rendu Remotion…',         sub: 'Animation et assemblage final' },
]

const MOTION_STYLES: StyleConfig[] = [
  { id: 'corporate', name: 'Corporate',  description: 'Professionnel et sobre, idéal B2B', pro: false },
  { id: 'dynamique', name: 'Dynamique',  description: 'Énergie et rythme, parfait pour les réseaux', pro: false },
  { id: 'luxe',      name: 'Luxe',       description: 'Élégant et premium, pour les marques haut de gamme', pro: true },
  { id: 'fun',       name: 'Fun',        description: 'Coloré et décalé, tonalité légère', pro: false },
]

const FORMAT_OPTIONS: { value: VideoFormat; label: string; desc: string }[] = [
  { value: '9:16', label: 'Vertical', desc: 'TikTok, Reels, Shorts' },
  { value: '1:1',  label: 'Carré',   desc: 'Instagram, Twitter' },
  { value: '16:9', label: 'Paysage', desc: 'YouTube, LinkedIn' },
]

const DURATION_OPTIONS: { value: VideoDuration; label: string }[] = [
  { value: '6s',  label: '6 sec' },
  { value: '15s', label: '15 sec' },
  { value: '30s', label: '30 sec' },
  { value: '60s', label: '1 min' },
]

const CONTEXTUAL_HELP = [
  'Décris en quelques phrases ce que tu veux communiquer et à qui.',
  'Le style définit l\'ambiance visuelle. Le format détermine le ratio.',
  'Tes couleurs de marque seront intégrées dans chaque scène.',
  'Choisis la voix et la musique de fond.',
  'Tout est prêt — lance le rendu Remotion.',
]

const FONTS = ['Inter', 'Poppins', 'Montserrat', 'Playfair Display', 'DM Sans', 'Space Grotesk']

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-xl text-foreground mb-1">{children}</h2>
}
function SectionSub({ children }: { children: React.ReactNode }) {
  return <p className="font-body text-sm text-[--text-muted] mb-6">{children}</p>
}

// ── Step 0 — Brief ─────────────────────────────────────────────────────────────

function StepBrief({ brief, onChange }: { brief: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-4">
      <SectionTitle>Ton brief</SectionTitle>
      <SectionSub>
        Décris le message que tu veux faire passer, ton audience cible et l&apos;objectif de la vidéo.
      </SectionSub>
      <textarea
        value={brief}
        onChange={e => onChange(e.target.value)}
        rows={10}
        placeholder="Ex: Nous sommes une startup SaaS qui aide les PME à automatiser leur comptabilité. Notre cible : dirigeants de 30-50 ans. Objectif : générer des leads qualifiés via LinkedIn..."
        className="w-full bg-muted border border-border rounded-xl px-4 py-3 font-body text-sm text-foreground placeholder-[--text-muted] resize-none focus:outline-none focus:border-blue-500/60 transition-colors"
      />
      <p className="font-mono text-xs text-[--text-muted] text-right">
        {brief.trim().length} / 1000 caractères recommandés
      </p>
    </div>
  )
}

// ── Step 1 — Style & Format ────────────────────────────────────────────────────

function StepStyleFormat({
  style, format, duration, onStyleChange, onFormatChange, onDurationChange,
}: {
  style: MotionStyle; format: VideoFormat; duration: VideoDuration
  onStyleChange: (v: MotionStyle) => void
  onFormatChange: (v: VideoFormat) => void
  onDurationChange: (v: VideoDuration) => void
}) {
  return (
    <div className="space-y-8">
      <div>
        <SectionTitle>Style</SectionTitle>
        <SectionSub>L&apos;ambiance visuelle de ta motion design vidéo.</SectionSub>
        <StyleCarousel
          styles={MOTION_STYLES}
          selected={style}
          onChange={(id) => onStyleChange(id as MotionStyle)}
          userPlan="free"
        />
      </div>

      <div>
        <SectionTitle>Format</SectionTitle>
        <SectionSub>Ratio et réseau de diffusion.</SectionSub>
        <div className="flex gap-4 flex-wrap mb-6">
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

        <SectionTitle>Durée</SectionTitle>
        <div className="flex gap-3 flex-wrap mt-3">
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

// ── Step 2 — Brand ─────────────────────────────────────────────────────────────

function StepBrand({
  primaryColor, secondaryColor, fontFamily,
  onPrimaryChange, onSecondaryChange, onFontChange,
}: {
  primaryColor: string; secondaryColor: string; fontFamily: string
  onPrimaryChange: (v: string) => void
  onSecondaryChange: (v: string) => void
  onFontChange: (v: string) => void
}) {
  return (
    <div className="space-y-6">
      <SectionTitle>Identité de marque</SectionTitle>
      <SectionSub>Ces éléments seront intégrés dans toutes les scènes de ta vidéo.</SectionSub>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="font-mono text-xs text-[--text-muted]">Couleur principale</label>
          <div className="flex items-center gap-3 bg-muted border border-border rounded-xl px-3 py-2">
            <input
              type="color"
              value={primaryColor}
              onChange={e => onPrimaryChange(e.target.value)}
              title="Couleur principale"
              aria-label="Couleur principale"
              className="w-8 h-8 rounded-lg border-0 bg-transparent cursor-pointer"
            />
            <span className="font-mono text-sm text-foreground">{primaryColor.toUpperCase()}</span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="font-mono text-xs text-[--text-muted]">Couleur secondaire</label>
          <div className="flex items-center gap-3 bg-muted border border-border rounded-xl px-3 py-2">
            <input
              type="color"
              value={secondaryColor}
              onChange={e => onSecondaryChange(e.target.value)}
              title="Couleur secondaire"
              aria-label="Couleur secondaire"
              className="w-8 h-8 rounded-lg border-0 bg-transparent cursor-pointer"
            />
            <span className="font-mono text-sm text-foreground">{secondaryColor.toUpperCase()}</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="font-mono text-xs text-[--text-muted]">Typographie</label>
        <div className="flex gap-2 flex-wrap">
          {FONTS.map(f => (
            <button
              key={f}
              type="button"
              onClick={() => onFontChange(f)}
              className={cn(
                'px-3 py-1.5 rounded-lg border text-sm transition-all duration-150',
                fontFamily === f
                  ? 'border-blue-500/40 bg-blue-500/10 text-blue-400'
                  : 'border-border bg-muted text-[--text-secondary] hover:border-border',
              )}
              data-font={f}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Step 3 — Voice & Audio ─────────────────────────────────────────────────────

function StepVoiceAudio({
  selectedVoice, onVoiceClick,
}: {
  selectedVoice?: ClyroVoice
  onVoiceClick: () => void
}) {
  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Voix</SectionTitle>
        <SectionSub>La voix qui lira le texte de tes scènes.</SectionSub>
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
            {selectedVoice
              ? <Volume2 size={18} className="text-blue-400" />
              : <Mic size={18} className="text-[--text-muted]" />}
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
              <p className="font-body text-sm text-[--text-muted]">
                Aucune voix sélectionnée — cliquer pour choisir
              </p>
            )}
          </div>
          <Badge variant="neutral">Changer</Badge>
        </button>
      </div>

      <div>
        <SectionTitle>Musique de fond</SectionTitle>
        <SectionSub>Optionnel — une piste musicale jouée en fond.</SectionSub>
        <div className="flex items-center gap-3 rounded-xl bg-muted border border-border px-4 py-3">
          <Music size={18} className="text-[--text-muted]" />
          <p className="font-body text-sm text-[--text-muted] flex-1">Aucune musique (coming soon)</p>
          <Badge variant="neutral">Bientôt</Badge>
        </div>
      </div>
    </div>
  )
}

// ── Step 4 — Review ────────────────────────────────────────────────────────────

function StepReview({
  title, brief, style, format, duration, primaryColor, voice,
}: {
  title: string; brief: string; style: MotionStyle; format: VideoFormat
  duration: VideoDuration; primaryColor: string; voice?: ClyroVoice
}) {
  const styleConfig = MOTION_STYLES.find(s => s.id === style)
  const rows: [string, string][] = [
    ['Titre',  title || '—'],
    ['Brief',  brief.substring(0, 60) + (brief.length > 60 ? '…' : '')],
    ['Style',  styleConfig?.name ?? style],
    ['Format', format],
    ['Durée',  duration],
    ['Couleur',primaryColor.toUpperCase()],
    ['Voix',   voice?.name ?? 'Non sélectionnée'],
  ]

  return (
    <div className="space-y-4">
      <SectionTitle>Prêt à rendre</SectionTitle>
      <SectionSub>Vérifie tes paramètres avant de lancer le rendu Remotion.</SectionSub>

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
        Le rendu prend 1 à 3 minutes. Tu seras notifié dès que ta vidéo est prête.
      </p>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function MotionNewPage() {
  const router = useRouter()

  const [currentStep,    setCurrentStep]    = useState(0)
  const [projectName,    setProjectName]    = useState('Nouveau projet Motion')
  const [lastSaved,      setLastSaved]      = useState<Date | null>(null)
  const [brief,          setBrief]          = useState('')
  const [style,          setStyle]          = useState<MotionStyle>('corporate')
  const [format,         setFormat]         = useState<VideoFormat>('16:9')
  const [duration,       setDuration]       = useState<VideoDuration>('30s')
  const [primaryColor,   setPrimaryColor]   = useState('#3B8EF0')
  const [secondaryColor, setSecondaryColor] = useState('#9B5CF6')
  const [fontFamily,     setFontFamily]     = useState('Inter')
  const [selectedVoice,  setSelectedVoice]  = useState<ClyroVoice | undefined>()

  const [voicePickerOpen, setVoicePickerOpen] = useState(false)
  const [libraryVoices,   setLibraryVoices]   = useState<ClyroVoice[]>([])
  const [voicesLoading,   setVoicesLoading]   = useState(false)

  const [generating,     setGenerating]     = useState(false)
  const [genStage,       setGenStage]       = useState(0)
  const [genProgress,    setGenProgress]    = useState(0)
  const [completedSteps, setCompletedSteps] = useState<string[]>([])

  const [resultVideoUrl, setResultVideoUrl] = useState<string | undefined>()
  const [resultOpen,     setResultOpen]     = useState(false)

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
    if (currentStep === 0) return brief.trim().length > 30
    return true
  }, [currentStep, brief])

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
      const result = await startMotionGeneration({
        title: projectName,
        brief,
        format,
        duration,
        style,
        brand_config: {
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          font_family: fontFamily,
          style,
        },
        voice_id: selectedVoice?.id,
      })

      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''

      await new Promise<void>((resolve, reject) => {
        const es = subscribeToVideoStatus(result.video_id, token, (data) => {
          const p = data.progress ?? 0
          setGenProgress(p)
          const idx = Math.min(
            Math.floor((p / 100) * GENERATION_STAGES.length),
            GENERATION_STAGES.length - 1,
          )
          setGenStage(idx)
          setCompletedSteps(prev => {
            const label = GENERATION_STAGES[idx]?.main ?? ''
            return prev.includes(label) ? prev : [...prev, label]
          })
          if (data.status === 'done')  resolve()
          if (data.status === 'error') reject(new Error('Génération échouée'))
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
        featureTitle="Motion Design"
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
        nextLabel={isLastStep ? 'Lancer le rendu' : 'Suivant'}
      >
        <div className="max-w-2xl mx-auto px-6 py-8">
          {currentStep === 0 && <StepBrief brief={brief} onChange={setBrief} />}
          {currentStep === 1 && (
            <StepStyleFormat
              style={style} format={format} duration={duration}
              onStyleChange={setStyle} onFormatChange={setFormat} onDurationChange={setDuration}
            />
          )}
          {currentStep === 2 && (
            <StepBrand
              primaryColor={primaryColor} secondaryColor={secondaryColor} fontFamily={fontFamily}
              onPrimaryChange={setPrimaryColor} onSecondaryChange={setSecondaryColor} onFontChange={setFontFamily}
            />
          )}
          {currentStep === 3 && (
            <StepVoiceAudio selectedVoice={selectedVoice} onVoiceClick={handleOpenVoicePicker} />
          )}
          {currentStep === 4 && (
            <StepReview
              title={projectName} brief={brief} style={style} format={format}
              duration={duration} primaryColor={primaryColor} voice={selectedVoice}
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
        onNewProject={() => { setResultOpen(false); router.push('/motion/new') }}
      />
    </>
  )
}
