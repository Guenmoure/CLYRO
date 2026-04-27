'use client'

import { useState, useCallback, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Upload, Sparkles, Palette, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n'
import { WizardLayout } from '@/components/creation/WizardLayout'
import { ResultModal, type BrandAsset } from '@/components/creation/ResultModal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  createBrandKit,
  uploadBrandLogo,
  generateBrandAsset,
} from '@/lib/api'
import { createBrowserClient } from '@/lib/supabase'
import { useDraftSave } from '@/hooks/use-draft-save'
import { toast } from '@/components/ui/toast'

// ── Constants ──────────────────────────────────────────────────────────────────

const STEP_IDS = ['brief', 'visuals', 'logo', 'assets', 'preview', 'export'] as const
const STEP_LABEL_KEYS = ['bn_step_brief', 'bn_step_visuals', 'bn_step_logo', 'bn_step_assets', 'bn_step_preview', 'bn_step_export'] as const
const CONTEXTUAL_HELP_KEYS = ['bn_help_0', 'bn_help_1', 'bn_help_2', 'bn_help_3', 'bn_help_4', 'bn_help_5'] as const

const PRESET_PALETTE_DEFS = [
  { key: 'bn_palette_clyroBlue',  primary: '#3B8EF0', secondary: '#9B5CF6' },
  { key: 'bn_palette_emerald',    primary: '#10B981', secondary: '#06B6D4' },
  { key: 'bn_palette_sunset',     primary: '#F97316', secondary: '#EF4444' },
  { key: 'bn_palette_roseGold',   primary: '#F43F5E', secondary: '#EC4899' },
  { key: 'bn_palette_midnight',   primary: '#6366F1', secondary: '#8B5CF6' },
  { key: 'bn_palette_gold',       primary: '#EAB308', secondary: '#F97316' },
]

const FONTS = ['Inter', 'Poppins', 'Montserrat', 'Playfair Display', 'DM Sans', 'Space Grotesk']

const ASSET_TYPE_DEFS = [
  { id: 'logo',         labelKey: 'bn_asset_logo_label',    descKey: 'bn_asset_logo_desc'    },
  { id: 'social_post',  labelKey: 'bn_asset_social_label',  descKey: 'bn_asset_social_desc'  },
  { id: 'banner',       labelKey: 'bn_asset_banner_label',  descKey: 'bn_asset_banner_desc'  },
  { id: 'thumbnail',    labelKey: 'bn_asset_thumb_label',   descKey: 'bn_asset_thumb_desc'   },
] as const

// ── Helpers ────────────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-xl text-foreground mb-1">{children}</h2>
}
function SectionSub({ children }: { children: React.ReactNode }) {
  return <p className="font-body text-sm text-[--text-muted] mb-6">{children}</p>
}

// ── Step 0 — Brief ─────────────────────────────────────────────────────────────

function StepBrief({
  name, industry, values, onChange,
}: {
  name: string; industry: string; values: string
  onChange: (field: 'name' | 'industry' | 'values', v: string) => void
}) {
  const { t } = useLanguage()
  return (
    <div className="space-y-5">
      <SectionTitle>{t('bn_brief_title')}</SectionTitle>
      <SectionSub>{t('bn_brief_sub')}</SectionSub>

      <div className="space-y-2">
        <label htmlFor="brand-name" className="font-mono text-xs text-[--text-muted]">{t('bn_brief_nameLabel')}</label>
        <input
          id="brand-name"
          type="text"
          value={name}
          onChange={e => onChange('name', e.target.value)}
          placeholder={t('bn_brief_namePlaceholder')}
          className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 font-body text-sm text-foreground placeholder-[--text-muted] focus:outline-none focus:border-blue-500/60 transition-colors"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="brand-industry" className="font-mono text-xs text-[--text-muted]">{t('bn_brief_industryLabel')}</label>
        <input
          id="brand-industry"
          type="text"
          value={industry}
          onChange={e => onChange('industry', e.target.value)}
          placeholder={t('bn_brief_industryPlaceholder')}
          className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 font-body text-sm text-foreground placeholder-[--text-muted] focus:outline-none focus:border-blue-500/60 transition-colors"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="brand-values" className="font-mono text-xs text-[--text-muted]">{t('bn_brief_valuesLabel')}</label>
        <textarea
          id="brand-values"
          value={values}
          onChange={e => onChange('values', e.target.value)}
          rows={5}
          placeholder={t('bn_brief_valuesPlaceholder')}
          className="w-full bg-muted border border-border rounded-xl px-4 py-3 font-body text-sm text-foreground placeholder-[--text-muted] resize-none focus:outline-none focus:border-blue-500/60 transition-colors"
        />
      </div>
    </div>
  )
}

// ── Step 1 — Visuals ───────────────────────────────────────────────────────────

function StepVisuals({
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
    <div className="space-y-7">
      <div>
        <SectionTitle>{t('bn_visuals_title')}</SectionTitle>
        <SectionSub>{t('bn_visuals_sub')}</SectionSub>
        <div className="flex gap-3 flex-wrap">
          {PRESET_PALETTE_DEFS.map(p => (
            <button
              key={p.key}
              type="button"
              onClick={() => { onPrimaryChange(p.primary); onSecondaryChange(p.secondary) }}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-xl border transition-all duration-150',
                primaryColor === p.primary && secondaryColor === p.secondary
                  ? 'border-blue-500/40 bg-blue-500/10'
                  : 'border-border bg-muted hover:border-border',
              )}
            >
              <div className="flex gap-1">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: p.primary }} />
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: p.secondary }} />
              </div>
              <span className="font-mono text-xs text-[--text-secondary]">{t(p.key)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="font-mono text-xs text-[--text-muted]">{t('bn_visuals_primaryColor')}</label>
          <div className="flex items-center gap-3 bg-muted border border-border rounded-xl px-3 py-2">
            <input
              type="color"
              value={primaryColor}
              onChange={e => onPrimaryChange(e.target.value)}
              title={t('bn_visuals_primaryColor')}
              aria-label={t('bn_visuals_primaryColor')}
              className="w-8 h-8 rounded-lg border-0 bg-transparent cursor-pointer"
            />
            <span className="font-mono text-sm text-foreground">{primaryColor.toUpperCase()}</span>
          </div>
        </div>
        <div className="space-y-2">
          <label className="font-mono text-xs text-[--text-muted]">{t('bn_visuals_secondaryColor')}</label>
          <div className="flex items-center gap-3 bg-muted border border-border rounded-xl px-3 py-2">
            <input
              type="color"
              value={secondaryColor}
              onChange={e => onSecondaryChange(e.target.value)}
              title={t('bn_visuals_secondaryColor')}
              aria-label={t('bn_visuals_secondaryColor')}
              className="w-8 h-8 rounded-lg border-0 bg-transparent cursor-pointer"
            />
            <span className="font-mono text-sm text-foreground">{secondaryColor.toUpperCase()}</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="font-mono text-xs text-[--text-muted]">{t('bn_visuals_typography')}</label>
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

// ── Step 2 — Logo ──────────────────────────────────────────────────────────────

function StepLogo({
  logoUrl, logoMode, logoPrompt,
  onLogoUrlChange, onLogoModeChange, onLogoPromptChange, onUpload,
  uploading,
}: {
  logoUrl?: string; logoMode: 'upload' | 'ai'; logoPrompt: string
  onLogoUrlChange: (url: string) => void
  onLogoModeChange: (m: 'upload' | 'ai') => void
  onLogoPromptChange: (v: string) => void
  onUpload: (f: File) => void
  uploading: boolean
}) {
  const { t } = useLanguage()

  function handleFileDrop(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onUpload(file)
  }

  return (
    <div className="space-y-6">
      <SectionTitle>{t('bn_logo_title')}</SectionTitle>
      <SectionSub>{t('bn_logo_sub')}</SectionSub>

      {/* Mode toggle */}
      <div className="flex gap-2 bg-muted rounded-xl p-1">
        {(['upload', 'ai'] as const).map(mode => (
          <button
            key={mode}
            type="button"
            onClick={() => onLogoModeChange(mode)}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 rounded-lg py-2 font-mono text-xs transition-all duration-150',
              logoMode === mode
                ? 'bg-border text-foreground'
                : 'text-[--text-muted] hover:text-foreground',
            )}
          >
            {mode === 'upload' ? <Upload size={13} /> : <Sparkles size={13} />}
            {mode === 'upload' ? t('bn_logo_upload') : t('bn_logo_generateAi')}
          </button>
        ))}
      </div>

      {logoMode === 'upload' ? (
        <label
          htmlFor="logo-upload"
          className={cn(
            'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 cursor-pointer transition-all duration-200',
            logoUrl
              ? 'border-success/40 bg-success/5'
              : 'border-border hover:border-blue-500/50 hover:bg-blue-500/5',
          )}
        >
          <input
            id="logo-upload"
            type="file"
            accept="image/png,image/svg+xml,image/jpeg,image/webp"
            className="sr-only"
            onChange={handleFileDrop}
            disabled={uploading}
          />
          {uploading ? (
            <p className="font-mono text-xs text-[--text-muted]">{t('bn_logo_uploading')}</p>
          ) : logoUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt={t('bn_logo_uploadedChange')} className="max-h-24 object-contain" />
              <p className="font-mono text-xs text-success">{t('bn_logo_uploadedChange')}</p>
            </>
          ) : (
            <>
              <Upload size={24} className="text-[--text-muted]" />
              <div className="text-center">
                <p className="font-display text-sm text-foreground">{t('bn_logo_dropOrClick')}</p>
                <p className="font-mono text-xs text-[--text-muted]">{t('bn_logo_maxSize')}</p>
              </div>
            </>
          )}
        </label>
      ) : (
        <div className="space-y-3">
          <label htmlFor="logo-prompt" className="font-mono text-xs text-[--text-muted]">
            {t('bn_logo_describeLabel')}
          </label>
          <textarea
            id="logo-prompt"
            value={logoPrompt}
            onChange={e => onLogoPromptChange(e.target.value)}
            rows={4}
            placeholder={t('bn_logo_describePlaceholder')}
            className="w-full bg-muted border border-border rounded-xl px-4 py-3 font-body text-sm text-foreground placeholder-[--text-muted] resize-none focus:outline-none focus:border-blue-500/60 transition-colors"
          />
          <p className="font-body text-xs text-[--text-muted]">
            {t('bn_logo_aiNote')}
          </p>
        </div>
      )}
    </div>
  )
}

// ── Step 3 — Assets ────────────────────────────────────────────────────────────

function StepAssets({
  selectedAssets, onToggle,
}: {
  selectedAssets: string[]
  onToggle: (id: string) => void
}) {
  const { t } = useLanguage()
  return (
    <div className="space-y-4">
      <SectionTitle>{t('bn_assets_title')}</SectionTitle>
      <SectionSub>{t('bn_assets_sub')}</SectionSub>

      <div className="space-y-2">
        {ASSET_TYPE_DEFS.map(asset => {
          const selected = selectedAssets.includes(asset.id)
          return (
            <button
              key={asset.id}
              type="button"
              onClick={() => onToggle(asset.id)}
              className={cn(
                'w-full flex items-center gap-4 rounded-xl px-4 py-3 border-2 transition-all duration-200 text-left',
                selected
                  ? 'border-blue-500/40 bg-blue-500/5'
                  : 'border-border bg-muted hover:border-border',
              )}
            >
              <div className={cn(
                'w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors',
                selected ? 'border-blue-500 bg-blue-500' : 'border-border',
              )}>
                {selected && <Check size={11} className="text-white" />}
              </div>
              <div>
                <p className="font-display text-sm text-foreground">{t(asset.labelKey)}</p>
                <p className="font-body text-xs text-[--text-muted]">{t(asset.descKey)}</p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Step 4 — Preview ───────────────────────────────────────────────────────────

function StepPreview({
  name, primaryColor, secondaryColor, fontFamily, logoUrl,
}: {
  name: string; primaryColor: string; secondaryColor: string; fontFamily: string; logoUrl?: string
}) {
  const { t } = useLanguage()
  return (
    <div className="space-y-5">
      <SectionTitle>{t('bn_preview_title')}</SectionTitle>
      <SectionSub>{t('bn_preview_sub')}</SectionSub>

      {/* Brand card preview */}
      <div className="rounded-2xl border border-border overflow-hidden">
        {/* Header gradient */}
        <div
          className="h-20 w-full"
          style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)` }}
        />

        <div className="bg-muted p-5 space-y-4">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Logo" className="w-12 h-12 object-contain rounded-xl bg-border p-1" />
            ) : (
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                style={{ backgroundColor: primaryColor }}
              >
                {name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="font-display text-base text-foreground">{name || t('bn_preview_brandNamePlaceholder')}</p>
              <p className="font-mono text-xs text-[--text-muted]">{fontFamily}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex items-center gap-2 bg-border rounded-lg px-3 py-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: primaryColor }} />
              <span className="font-mono text-xs text-[--text-secondary]">{primaryColor.toUpperCase()}</span>
            </div>
            <div className="flex items-center gap-2 bg-border rounded-lg px-3 py-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: secondaryColor }} />
              <span className="font-mono text-xs text-[--text-secondary]">{secondaryColor.toUpperCase()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Step 5 — Export ────────────────────────────────────────────────────────────

function StepExport({
  name, selectedAssets, generating,
}: {
  name: string; selectedAssets: string[]; generating: boolean
}) {
  const { t } = useLanguage()
  const selectedLabels = ASSET_TYPE_DEFS.filter(a => selectedAssets.includes(a.id)).map(a => t(a.labelKey))

  return (
    <div className="space-y-5">
      <SectionTitle>{t('bn_export_title')}</SectionTitle>
      <SectionSub>{t('bn_export_sub')}</SectionSub>

      <div className="rounded-xl bg-muted border border-border p-5 space-y-3">
        <p className="font-display text-sm text-foreground">{name || t('bn_export_defaultName')}</p>
        <div className="flex flex-wrap gap-2">
          {selectedLabels.map(label => (
            <Badge key={label} variant="neutral">{label}</Badge>
          ))}
          {selectedLabels.length === 0 && (
            <p className="font-mono text-xs text-[--text-muted]">{t('bn_export_noAssets')}</p>
          )}
        </div>
      </div>

      {generating && (
        <div className="rounded-xl bg-muted border border-border px-4 py-3 flex items-center gap-3">
          <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin shrink-0" />
          <p className="font-body text-sm text-[--text-secondary]">{t('bn_export_generating')}</p>
        </div>
      )}

      <p className="font-body text-xs text-[--text-muted] text-center">
        {t('bn_export_timeNote')}
      </p>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

function BrandNewPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialDraftId = searchParams.get('draft')
  const { t } = useLanguage()

  const STEPS = STEP_IDS.map((id, i) => ({ id, label: t(STEP_LABEL_KEYS[i]) }))
  const CONTEXTUAL_HELP = CONTEXTUAL_HELP_KEYS.map(k => t(k))

  const [currentStep,    setCurrentStep]    = useState(0)
  const [projectName,    setProjectName]    = useState(() => t('bn_defaultProjectName'))
  const [restored,       setRestored]       = useState(false)

  // Brief
  const [brandName,     setBrandName]     = useState('')
  const [industry,      setIndustry]      = useState('')
  const [values,        setValues]        = useState('')

  // Visuals
  const [primaryColor,   setPrimaryColor]   = useState('#3B8EF0')
  const [secondaryColor, setSecondaryColor] = useState('#9B5CF6')
  const [fontFamily,     setFontFamily]     = useState('Inter')

  // Logo
  const [logoMode,    setLogoMode]    = useState<'upload' | 'ai'>('upload')
  const [logoUrl,     setLogoUrl]     = useState<string | undefined>()
  const [logoPrompt,  setLogoPrompt]  = useState('')
  const [uploading,   setUploading]   = useState(false)

  // Assets
  const [selectedAssets, setSelectedAssets] = useState<string[]>(['logo', 'social_post'])

  // Generation
  const [generating,  setGenerating]  = useState(false)
  const [resultAssets, setResultAssets] = useState<BrandAsset[]>([])
  const [resultOpen,  setResultOpen]  = useState(false)

  // ── Restore draft from DB ───────────────────────────────────────────────────
  useEffect(() => {
    if (!initialDraftId || restored) return
    async function loadDraft() {
      const supabase = createBrowserClient()
      const { data } = await (supabase
        .from('videos')
        .select('wizard_step, wizard_state, title')
        .eq('id', initialDraftId)
        .single() as Promise<any>)
      if (!data) return
      setRestored(true)
      const s = data.wizard_state as Record<string, any>
      if (data.title)           setProjectName(data.title)
      if (s.brandName)          setBrandName(s.brandName)
      if (s.industry)           setIndustry(s.industry)
      if (s.values)             setValues(s.values)
      if (s.primaryColor)       setPrimaryColor(s.primaryColor)
      if (s.secondaryColor)     setSecondaryColor(s.secondaryColor)
      if (s.fontFamily)         setFontFamily(s.fontFamily)
      if (s.logoMode)           setLogoMode(s.logoMode)
      if (s.logoUrl)            setLogoUrl(s.logoUrl)
      if (s.logoPrompt)         setLogoPrompt(s.logoPrompt)
      if (s.selectedAssets)     setSelectedAssets(s.selectedAssets)
      const step = Math.max(0, (data.wizard_step ?? 1) - 1)
      setCurrentStep(step)
      if (step >= 3) {
        toast.success(t('bn_toast_restored'))
      }
    }
    loadDraft()
  }, [initialDraftId, restored])

  // ── Draft auto-save ─────────────────────────────────────────────────────────
  const { lastSaved } = useDraftSave({
    module:      'brand',
    title:       projectName,
    style:       'brand-kit',
    currentStep,
    totalSteps:  STEPS.length,
    stepLabel:   STEPS[currentStep]?.label ?? '',
    state:       { brandName, industry, values, primaryColor, secondaryColor, fontFamily, logoMode, logoUrl, logoPrompt, selectedAssets },
    initialDraftId,
  })

  function handleBriefChange(field: 'name' | 'industry' | 'values', v: string) {
    if (field === 'name')     setBrandName(v)
    if (field === 'industry') setIndustry(v)
    if (field === 'values')   setValues(v)
    if (field === 'name')     setProjectName(v || t('bn_defaultProjectName'))
  }

  function toggleAsset(id: string) {
    setSelectedAssets(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id],
    )
  }

  async function handleUploadLogo(file: File) {
    setUploading(true)
    try {
      const supabase = createBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const url = await uploadBrandLogo(file, user.id)
      setLogoUrl(url)
    } catch {
      // silent — user can retry
    } finally {
      setUploading(false)
    }
  }

  const canNext = useCallback(() => {
    if (currentStep === 0) return brandName.trim().length > 0
    if (currentStep === 2 && logoMode === 'ai') return logoPrompt.trim().length > 10
    return true
  }, [currentStep, brandName, logoMode, logoPrompt])

  function handleNext() {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(s => s + 1)
    } else {
      handleGenerate()
    }
  }

  async function handleGenerate() {
    setGenerating(true)
    try {
      // 1. Create brand kit
      const kit = await createBrandKit({
        name: brandName,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        font_family: fontFamily,
        logo_url: logoUrl,
      })

      const brandKitId = kit.data.id
      const assets: BrandAsset[] = []

      // 2. Generate selected assets
      for (const type of selectedAssets) {
        if (type !== 'logo' && type !== 'social_post') continue
        try {
          const res = await generateBrandAsset({
            brand_kit_id: brandKitId,
            type: type as 'logo' | 'social_post',
            prompt: `${brandName} — ${values}`,
          })
          assets.push({
            label: (() => { const def = ASSET_TYPE_DEFS.find(a => a.id === type); return def ? t(def.labelKey) : type })(),
            url: res.data.image_url,
            type: 'image',
          })
        } catch {
          // continue with other assets
        }
      }

      setResultAssets(assets)
      setGenerating(false)
      setResultOpen(true)
    } catch {
      setGenerating(false)
    }
  }

  const isLastStep = currentStep === STEPS.length - 1

  return (
    <>
      <WizardLayout
        featureTitle={t('bh_moduleTitle')}
        featureHref="/brand"
        currentPageLabel={t('bn_currentPageLabel')}
        steps={STEPS}
        currentStep={currentStep}
        projectName={projectName}
        onProjectNameChange={setProjectName}
        contextualHelp={CONTEXTUAL_HELP[currentStep]}
        lastSaved={lastSaved}
        onStepClick={setCurrentStep}
        canPrev={currentStep > 0}
        canNext={canNext()}
        onPrev={() => setCurrentStep(s => s - 1)}
        onNext={handleNext}
        nextLabel={isLastStep ? t('bn_generateLabel') : t('bn_nextLabel')}
        isNextLoading={generating && isLastStep}
      >
        <div className="max-w-2xl mx-auto px-6 py-8">
          {currentStep === 0 && (
            <StepBrief
              name={brandName} industry={industry} values={values}
              onChange={handleBriefChange}
            />
          )}
          {currentStep === 1 && (
            <StepVisuals
              primaryColor={primaryColor} secondaryColor={secondaryColor} fontFamily={fontFamily}
              onPrimaryChange={setPrimaryColor} onSecondaryChange={setSecondaryColor} onFontChange={setFontFamily}
            />
          )}
          {currentStep === 2 && (
            <StepLogo
              logoUrl={logoUrl} logoMode={logoMode} logoPrompt={logoPrompt}
              onLogoUrlChange={setLogoUrl} onLogoModeChange={setLogoMode}
              onLogoPromptChange={setLogoPrompt} onUpload={handleUploadLogo}
              uploading={uploading}
            />
          )}
          {currentStep === 3 && (
            <StepAssets selectedAssets={selectedAssets} onToggle={toggleAsset} />
          )}
          {currentStep === 4 && (
            <StepPreview
              name={brandName} primaryColor={primaryColor} secondaryColor={secondaryColor}
              fontFamily={fontFamily} logoUrl={logoUrl}
            />
          )}
          {currentStep === 5 && (
            <StepExport name={brandName} selectedAssets={selectedAssets} generating={generating} />
          )}
        </div>
      </WizardLayout>

      <ResultModal
        isOpen={resultOpen}
        onClose={() => setResultOpen(false)}
        type="brand"
        title={`${brandName} — Brand Kit`}
        assets={resultAssets}
        onNewProject={() => { setResultOpen(false); router.push('/brand/new') }}
      />
    </>
  )
}

export default function BrandNewPage() {
  return (
    <Suspense>
      <BrandNewPageInner />
    </Suspense>
  )
}
