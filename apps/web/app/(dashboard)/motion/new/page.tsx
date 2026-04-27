'use client'

import { useState, useCallback, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useDraftSave } from '@/hooks/use-draft-save'
import { Volume2, Mic, Music } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WizardLayout } from '@/components/creation/WizardLayout'
import { GenerationOverlay, type GenerationStage } from '@/components/creation/GenerationOverlay'
import { StyleCarousel, type StyleConfig } from '@/components/creation/StyleCarousel'
import { VoicePickerModal, type ClyroVoice } from '@/components/creation/VoicePickerModal'
import { ResultModal } from '@/components/creation/ResultModal'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/toast'
import {
  startMotionGeneration,
  getPublicVoices,
  subscribeToVideoStatus,
} from '@/lib/api'
import { createBrowserClient } from '@/lib/supabase'
import { useLanguage } from '@/lib/i18n'
import type { MotionStyle, VideoFormat, VideoDuration } from '@clyro/shared'

// ── Constants (id-only — labels resolved via t() inside components) ────────────

const STEP_IDS = ['brief', 'style', 'brand', 'voice', 'review'] as const

const MOTION_STYLE_IDS: { id: MotionStyle; pro: boolean }[] = [
  { id: 'corporate', pro: false },
  { id: 'dynamique', pro: false },
  { id: 'luxe',      pro: true  },
  { id: 'fun',       pro: false },
]

const FORMAT_VALUES: { value: VideoFormat; tk_label: string; tk_desc: string }[] = [
  { value: '9:16', tk_label: 'mn_format_vertical_label',  tk_desc: 'mn_format_vertical_desc'  },
  { value: '1:1',  tk_label: 'mn_format_square_label',    tk_desc: 'mn_format_square_desc'    },
  { value: '16:9', tk_label: 'mn_format_landscape_label', tk_desc: 'mn_format_landscape_desc' },
]

const DURATION_VALUES: { value: VideoDuration; tk: string }[] = [
  { value: 'auto', tk: 'mn_duration_auto'  },
  { value: '6s',   tk: 'mn_duration_6s'   },
  { value: '15s',  tk: 'mn_duration_15s'  },
  { value: '30s',  tk: 'mn_duration_30s'  },
  { value: '60s',  tk: 'mn_duration_60s'  },
  { value: '120s', tk: 'mn_duration_120s' },
  { value: '180s', tk: 'mn_duration_180s' },
  { value: '300s', tk: 'mn_duration_300s' },
]

// Maps style id → translation key prefix
const styleKeyMap: Record<string, string> = {
  corporate: 'mn_style_corporate',
  dynamique: 'mn_style_dynamique',
  luxe:      'mn_style_luxe',
  fun:       'mn_style_fun',
}

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
  const { t } = useLanguage()
  return (
    <div className="space-y-4">
      <SectionTitle>{t('mn_brief_title')}</SectionTitle>
      <SectionSub>{t('mn_brief_sub')}</SectionSub>
      <textarea
        value={brief}
        onChange={e => onChange(e.target.value)}
        rows={10}
        placeholder={t('mn_brief_placeholder')}
        className="w-full bg-muted border border-border rounded-xl px-4 py-3 font-body text-sm text-foreground placeholder-[--text-muted] resize-none focus:outline-none focus:border-blue-500/60 transition-colors"
      />
      <p className="font-mono text-xs text-[--text-muted] text-right">
        {t('mn_brief_chars').replace('{n}', String(brief.trim().length))}
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
  const { t } = useLanguage()

  const motionStyles: StyleConfig[] = MOTION_STYLE_IDS.map(({ id, pro }) => ({
    id,
    pro,
    name:        t(`${styleKeyMap[id]}_name` as any),
    description: t(`${styleKeyMap[id]}_desc` as any),
  }))

  const formatOptions = FORMAT_VALUES.map(o => ({
    ...o,
    label: t(o.tk_label as any),
    desc:  t(o.tk_desc  as any),
  }))

  const durationOptions = DURATION_VALUES.map(o => ({
    ...o,
    label: t(o.tk as any),
  }))

  return (
    <div className="space-y-8">
      <div>
        <SectionTitle>{t('mn_style_title')}</SectionTitle>
        <SectionSub>{t('mn_style_sub')}</SectionSub>
        <StyleCarousel
          styles={motionStyles}
          selected={style}
          onChange={(id) => onStyleChange(id as MotionStyle)}
          userPlan="free"
        />
      </div>

      <div>
        <SectionTitle>{t('mn_format_title')}</SectionTitle>
        <SectionSub>{t('mn_format_sub')}</SectionSub>
        <div className="flex gap-4 flex-wrap mb-6">
          {formatOptions.map(opt => (
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

        <SectionTitle>{t('mn_duration_title')}</SectionTitle>
        <div className="flex gap-3 flex-wrap mt-3">
          {durationOptions.map(opt => (
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
  const { t } = useLanguage()
  return (
    <div className="space-y-6">
      <SectionTitle>{t('mn_brand_title')}</SectionTitle>
      <SectionSub>{t('mn_brand_sub')}</SectionSub>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="font-mono text-xs text-[--text-muted]">{t('mn_primary_color_label')}</label>
          <div className="flex items-center gap-3 bg-muted border border-border rounded-xl px-3 py-2">
            <input
              type="color"
              value={primaryColor}
              onChange={e => onPrimaryChange(e.target.value)}
              title={t('mn_primary_color_label')}
              aria-label={t('mn_primary_color_label')}
              className="w-8 h-8 rounded-lg border-0 bg-transparent cursor-pointer"
            />
            <span className="font-mono text-sm text-foreground">{primaryColor.toUpperCase()}</span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="font-mono text-xs text-[--text-muted]">{t('mn_secondary_color_label')}</label>
          <div className="flex items-center gap-3 bg-muted border border-border rounded-xl px-3 py-2">
            <input
              type="color"
              value={secondaryColor}
              onChange={e => onSecondaryChange(e.target.value)}
              title={t('mn_secondary_color_label')}
              aria-label={t('mn_secondary_color_label')}
              className="w-8 h-8 rounded-lg border-0 bg-transparent cursor-pointer"
            />
            <span className="font-mono text-sm text-foreground">{secondaryColor.toUpperCase()}</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="font-mono text-xs text-[--text-muted]">{t('mn_typography_label')}</label>
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
  const { t } = useLanguage()
  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>{t('mn_voice_title')}</SectionTitle>
        <SectionSub>{t('mn_voice_sub')}</SectionSub>
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
                {t('mn_no_voice')}
              </p>
            )}
          </div>
          <Badge variant="neutral">{t('mn_voice_change')}</Badge>
        </button>
      </div>

      <div>
        <SectionTitle>{t('mn_bg_music_title')}</SectionTitle>
        <SectionSub>{t('mn_bg_music_sub')}</SectionSub>
        <div className="flex items-center gap-3 rounded-xl bg-muted border border-border px-4 py-3">
          <Music size={18} className="text-[--text-muted]" />
          <p className="font-body text-sm text-[--text-muted] flex-1">{t('mn_no_music_coming_soon')}</p>
          <Badge variant="neutral">{t('mn_music_soon')}</Badge>
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
  const { t } = useLanguage()
  const styleName = t(`${styleKeyMap[style]}_name` as any)
  const rows: [string, string][] = [
    [t('mn_review_row_title'),    title || '—'],
    [t('mn_review_row_brief'),    brief.substring(0, 60) + (brief.length > 60 ? '…' : '')],
    [t('mn_review_row_style'),    styleName],
    [t('mn_review_row_format'),   format],
    [t('mn_review_row_duration'), duration],
    [t('mn_review_row_color'),    primaryColor.toUpperCase()],
    [t('mn_review_row_voice'),    voice?.name ?? t('mn_review_row_voice_none')],
  ]

  return (
    <div className="space-y-4">
      <SectionTitle>{t('mn_review_title')}</SectionTitle>
      <SectionSub>{t('mn_review_sub')}</SectionSub>

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
        {t('mn_review_timing')}
      </p>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

function MotionNewPageInner() {
  const router     = useRouter()
  const params     = useSearchParams()
  const draftParam = params.get('draft')
  const { t }      = useLanguage()

  const STEPS = STEP_IDS.map((id) => ({
    id,
    label: t(`mn_step_${id}` as any),
  }))

  const GENERATION_STAGES: GenerationStage[] = [
    { main: t('mn_genStage0_main'), sub: t('mn_genStage0_sub') },
    { main: t('mn_genStage1_main'), sub: t('mn_genStage1_sub') },
    { main: t('mn_genStage2_main'), sub: t('mn_genStage2_sub') },
    { main: t('mn_genStage3_main'), sub: t('mn_genStage3_sub') },
    { main: t('mn_genStage4_main'), sub: t('mn_genStage4_sub') },
  ]

  const CONTEXTUAL_HELP = STEP_IDS.map((_, i) => t(`mn_help_${i}` as any))

  const [currentStep,    setCurrentStep]    = useState(0)
  const [projectName,    setProjectName]    = useState(() => t('mn_defaultProjectName'))
  const [brief,          setBrief]          = useState('')
  const [style,          setStyle]          = useState<MotionStyle>('corporate')
  const [format,         setFormat]         = useState<VideoFormat>('16:9')
  const [duration,       setDuration]       = useState<VideoDuration>('auto')
  const [primaryColor,   setPrimaryColor]   = useState('#3B8EF0')
  const [secondaryColor, setSecondaryColor] = useState('#9B5CF6')
  const [fontFamily,     setFontFamily]     = useState('Inter')
  const [selectedVoice,  setSelectedVoice]  = useState<ClyroVoice | undefined>()

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
        if (s.brief)          setBrief(s.brief as string)
        if (s.style)          setStyle(s.style as MotionStyle)
        if (s.format)         setFormat(s.format as VideoFormat)
        if (s.duration)       setDuration(s.duration as VideoDuration)
        if (s.primaryColor)   setPrimaryColor(s.primaryColor as string)
        if (s.secondaryColor) setSecondaryColor(s.secondaryColor as string)
        if (s.fontFamily)     setFontFamily(s.fontFamily as string)
        if (s.selectedVoice)  setSelectedVoice(s.selectedVoice as ClyroVoice)
        if (typeof data.wizard_step === 'number' && data.wizard_step >= 4) {
          toast.success(t('mn_toast_projectRestored'))
        }
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftParam])

  // DB-backed draft auto-save
  const { wasRestored, lastSaved, isSaving: draftIsSaving, clearDraft } = useDraftSave({
    module:      'motion',
    title:       projectName,
    style:       style as string,
    currentStep,
    totalSteps:  STEPS.length,
    stepLabel:   STEPS[currentStep]?.label ?? '',
    state:       { brief, style, format, duration, primaryColor, secondaryColor, fontFamily, selectedVoice },
    initialDraftId: draftParam,
  })

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
    if (brief.trim().length < 20) {
      toast.error(t('mn_toast_briefTooShort'))
      setCurrentStep(0)
      return
    }

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
          if (data.status === 'error') reject(new Error('Generation failed'))
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('mn_toast_unknownError')
      console.error('[motion/new] generation failed:', err)
      toast.error(t('mn_toast_generationFailed').replace('{msg}', msg))
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
        featureTitle={t('mn_featureTitle')}
        featureHref="/motion"
        currentPageLabel={t('mn_newVideo')}
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
        nextLabel={isLastStep ? t('mn_launchLabel') : t('mn_nextLabel')}
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

export default function MotionNewPage() {
  return (
    <Suspense>
      <MotionNewPageInner />
    </Suspense>
  )
}
