'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, Sparkles, Palette, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
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

// ── Constants ──────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 'brief',    label: 'Brief' },
  { id: 'visuals',  label: 'Identité visuelle' },
  { id: 'logo',     label: 'Logo' },
  { id: 'assets',   label: 'Assets' },
  { id: 'preview',  label: 'Prévisualisation' },
  { id: 'export',   label: 'Export' },
]

const CONTEXTUAL_HELP = [
  'Décris ton entreprise, ton secteur et tes valeurs de marque.',
  'Choisis tes couleurs et ta typographie.',
  'Upload ton logo ou génère-en un via IA.',
  'Sélectionne les types d\'assets à générer.',
  'Revois l\'ensemble de ton identité avant l\'export.',
  'Génère et exporte ton kit de marque complet.',
]

const PRESET_PALETTES = [
  { name: 'CLYRO Blue',   primary: '#3B8EF0', secondary: '#9B5CF6' },
  { name: 'Emerald',      primary: '#10B981', secondary: '#06B6D4' },
  { name: 'Sunset',       primary: '#F97316', secondary: '#EF4444' },
  { name: 'Rose Gold',    primary: '#F43F5E', secondary: '#EC4899' },
  { name: 'Midnight',     primary: '#6366F1', secondary: '#8B5CF6' },
  { name: 'Gold',         primary: '#EAB308', secondary: '#F97316' },
]

const FONTS = ['Inter', 'Poppins', 'Montserrat', 'Playfair Display', 'DM Sans', 'Space Grotesk']

const ASSET_TYPES = [
  { id: 'logo',         label: 'Logo IA',           desc: 'Logo généré par intelligence artificielle' },
  { id: 'social_post',  label: 'Post Instagram',     desc: 'Visuels carrés 1080×1080 px' },
  { id: 'banner',       label: 'Bannière LinkedIn',  desc: 'Format 1584×396 px' },
  { id: 'thumbnail',    label: 'Miniature YouTube',  desc: 'Format 1280×720 px' },
]

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
  return (
    <div className="space-y-5">
      <SectionTitle>Ton entreprise</SectionTitle>
      <SectionSub>Ces informations guideront l&apos;IA pour créer une identité cohérente.</SectionSub>

      <div className="space-y-2">
        <label htmlFor="brand-name" className="font-mono text-xs text-[--text-muted]">Nom de la marque *</label>
        <input
          id="brand-name"
          type="text"
          value={name}
          onChange={e => onChange('name', e.target.value)}
          placeholder="Ex: CLYRO, Acme Corp, Studio Nova…"
          className="w-full bg-navy-800 border border-navy-700 rounded-xl px-4 py-2.5 font-body text-sm text-foreground placeholder-[--text-muted] focus:outline-none focus:border-blue-500/60 transition-colors"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="brand-industry" className="font-mono text-xs text-[--text-muted]">Secteur d&apos;activité</label>
        <input
          id="brand-industry"
          type="text"
          value={industry}
          onChange={e => onChange('industry', e.target.value)}
          placeholder="Ex: Tech SaaS, Mode, Restauration, Conseil…"
          className="w-full bg-navy-800 border border-navy-700 rounded-xl px-4 py-2.5 font-body text-sm text-foreground placeholder-[--text-muted] focus:outline-none focus:border-blue-500/60 transition-colors"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="brand-values" className="font-mono text-xs text-[--text-muted]">Valeurs & tonalité</label>
        <textarea
          id="brand-values"
          value={values}
          onChange={e => onChange('values', e.target.value)}
          rows={5}
          placeholder="Ex: Innovation, confiance, accessibilité. Ton : moderne et chaleureux. Cible : entrepreneurs 25-40 ans…"
          className="w-full bg-navy-800 border border-navy-700 rounded-xl px-4 py-3 font-body text-sm text-foreground placeholder-[--text-muted] resize-none focus:outline-none focus:border-blue-500/60 transition-colors"
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
  return (
    <div className="space-y-7">
      <div>
        <SectionTitle>Palettes prédéfinies</SectionTitle>
        <SectionSub>Choisis une palette ou personnalise les couleurs ci-dessous.</SectionSub>
        <div className="flex gap-3 flex-wrap">
          {PRESET_PALETTES.map(p => (
            <button
              key={p.name}
              type="button"
              onClick={() => { onPrimaryChange(p.primary); onSecondaryChange(p.secondary) }}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-xl border transition-all duration-150',
                primaryColor === p.primary && secondaryColor === p.secondary
                  ? 'border-blue-500/40 bg-blue-500/10'
                  : 'border-navy-700 bg-navy-800 hover:border-navy-600',
              )}
            >
              <div className="flex gap-1">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: p.primary }} />
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: p.secondary }} />
              </div>
              <span className="font-mono text-xs text-[--text-secondary]">{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="font-mono text-xs text-[--text-muted]">Couleur principale</label>
          <div className="flex items-center gap-3 bg-navy-800 border border-navy-700 rounded-xl px-3 py-2">
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
          <div className="flex items-center gap-3 bg-navy-800 border border-navy-700 rounded-xl px-3 py-2">
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
                  : 'border-navy-700 bg-navy-800 text-[--text-secondary] hover:border-navy-600',
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
  function handleFileDrop(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onUpload(file)
  }

  return (
    <div className="space-y-6">
      <SectionTitle>Logo</SectionTitle>
      <SectionSub>Upload ton logo existant ou génère-en un nouveau via IA.</SectionSub>

      {/* Mode toggle */}
      <div className="flex gap-2 bg-navy-800 rounded-xl p-1">
        {(['upload', 'ai'] as const).map(mode => (
          <button
            key={mode}
            type="button"
            onClick={() => onLogoModeChange(mode)}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 rounded-lg py-2 font-mono text-xs transition-all duration-150',
              logoMode === mode
                ? 'bg-navy-700 text-foreground'
                : 'text-[--text-muted] hover:text-foreground',
            )}
          >
            {mode === 'upload' ? <Upload size={13} /> : <Sparkles size={13} />}
            {mode === 'upload' ? 'Uploader' : 'Générer via IA'}
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
              : 'border-navy-600 hover:border-blue-500/50 hover:bg-blue-500/5',
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
            <p className="font-mono text-xs text-[--text-muted]">Upload en cours…</p>
          ) : logoUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt="Logo uploadé" className="max-h-24 object-contain" />
              <p className="font-mono text-xs text-success">Logo uploadé — cliquer pour changer</p>
            </>
          ) : (
            <>
              <Upload size={24} className="text-[--text-muted]" />
              <div className="text-center">
                <p className="font-display text-sm text-foreground">Glisser-déposer ou cliquer</p>
                <p className="font-mono text-xs text-[--text-muted]">PNG, SVG, JPG · Max 5 Mo</p>
              </div>
            </>
          )}
        </label>
      ) : (
        <div className="space-y-3">
          <label htmlFor="logo-prompt" className="font-mono text-xs text-[--text-muted]">
            Décris ton logo idéal
          </label>
          <textarea
            id="logo-prompt"
            value={logoPrompt}
            onChange={e => onLogoPromptChange(e.target.value)}
            rows={4}
            placeholder="Ex: Logo minimaliste avec un éclair stylisé, style tech moderne, couleurs bleu électrique et violet…"
            className="w-full bg-navy-800 border border-navy-700 rounded-xl px-4 py-3 font-body text-sm text-foreground placeholder-[--text-muted] resize-none focus:outline-none focus:border-blue-500/60 transition-colors"
          />
          <p className="font-body text-xs text-[--text-muted]">
            Le logo sera généré lors de l&apos;étape Export.
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
  return (
    <div className="space-y-4">
      <SectionTitle>Assets à générer</SectionTitle>
      <SectionSub>Sélectionne les formats que tu veux créer avec ton identité de marque.</SectionSub>

      <div className="space-y-2">
        {ASSET_TYPES.map(asset => {
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
                  : 'border-navy-700 bg-navy-800 hover:border-navy-600',
              )}
            >
              <div className={cn(
                'w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors',
                selected ? 'border-blue-500 bg-blue-500' : 'border-navy-600',
              )}>
                {selected && <Check size={11} className="text-white" />}
              </div>
              <div>
                <p className="font-display text-sm text-foreground">{asset.label}</p>
                <p className="font-body text-xs text-[--text-muted]">{asset.desc}</p>
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
  return (
    <div className="space-y-5">
      <SectionTitle>Prévisualisation</SectionTitle>
      <SectionSub>Aperçu de ton identité de marque avant génération.</SectionSub>

      {/* Brand card preview */}
      <div className="rounded-2xl border border-navy-700 overflow-hidden">
        {/* Header gradient */}
        <div
          className="h-20 w-full"
          style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)` }}
        />

        <div className="bg-navy-800 p-5 space-y-4">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Logo" className="w-12 h-12 object-contain rounded-xl bg-navy-700 p-1" />
            ) : (
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                style={{ backgroundColor: primaryColor }}
              >
                {name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="font-display text-base text-foreground">{name || 'Nom de marque'}</p>
              <p className="font-mono text-xs text-[--text-muted]">{fontFamily}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex items-center gap-2 bg-navy-700 rounded-lg px-3 py-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: primaryColor }} />
              <span className="font-mono text-xs text-[--text-secondary]">{primaryColor.toUpperCase()}</span>
            </div>
            <div className="flex items-center gap-2 bg-navy-700 rounded-lg px-3 py-1.5">
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
  const selectedLabels = ASSET_TYPES.filter(a => selectedAssets.includes(a.id)).map(a => a.label)

  return (
    <div className="space-y-5">
      <SectionTitle>Prêt à exporter</SectionTitle>
      <SectionSub>
        L&apos;IA va générer ton Brand Kit complet et tous les assets sélectionnés.
      </SectionSub>

      <div className="rounded-xl bg-navy-800 border border-navy-700 p-5 space-y-3">
        <p className="font-display text-sm text-foreground">{name || 'Mon Brand Kit'}</p>
        <div className="flex flex-wrap gap-2">
          {selectedLabels.map(label => (
            <Badge key={label} variant="neutral">{label}</Badge>
          ))}
          {selectedLabels.length === 0 && (
            <p className="font-mono text-xs text-[--text-muted]">Aucun asset sélectionné</p>
          )}
        </div>
      </div>

      {generating && (
        <div className="rounded-xl bg-navy-800 border border-navy-700 px-4 py-3 flex items-center gap-3">
          <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin shrink-0" />
          <p className="font-body text-sm text-[--text-secondary]">Génération du Brand Kit en cours…</p>
        </div>
      )}

      <p className="font-body text-xs text-[--text-muted] text-center">
        La génération prend 30 à 90 secondes selon le nombre d&apos;assets.
      </p>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function BrandNewPage() {
  const router = useRouter()

  const [currentStep,    setCurrentStep]    = useState(0)
  const [projectName,    setProjectName]    = useState('Nouveau Brand Kit')
  const [lastSaved,      setLastSaved]      = useState<Date | null>(null)

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

  function handleBriefChange(field: 'name' | 'industry' | 'values', v: string) {
    if (field === 'name')     setBrandName(v)
    if (field === 'industry') setIndustry(v)
    if (field === 'values')   setValues(v)
    if (field === 'name')     setProjectName(v || 'Nouveau Brand Kit')
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
      if (!user) throw new Error('Non authentifié')
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
            label: ASSET_TYPES.find(a => a.id === type)?.label ?? type,
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
        featureTitle="Brand Kit"
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
        nextLabel={isLastStep ? 'Générer le Brand Kit' : 'Suivant'}
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
