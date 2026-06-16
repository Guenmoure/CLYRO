'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Logo } from '@/components/ui/Logo'
import { Button } from '@/components/ui/button'
import { createBrowserClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n'

// ── Types ──────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4

interface PlanFeature {
  text: string
  included: boolean
}

interface Plan {
  id: 'starter' | 'pro' | 'studio'
  label: string
  badge?: string
  price: string
  priceNote: string
  features: PlanFeature[]
  cta: string
  highlighted: boolean
}

// ── Data ───────────────────────────────────────────────────────────────────────

const NICHE_OPTIONS: Array<{ id: string; emoji: string; labelKey: string }> = [
  { id: 'education',  emoji: '🎓', labelKey: 'ob_nicheEducation'  },
  { id: 'ecommerce',  emoji: '🛒', labelKey: 'ob_nicheEcommerce'  },
  { id: 'tech',       emoji: '💻', labelKey: 'ob_nicheTech'        },
  { id: 'finance',    emoji: '📊', labelKey: 'ob_nicheFinance'     },
  { id: 'lifestyle',  emoji: '✨', labelKey: 'ob_nicheLifestyle'   },
  { id: 'marketing',  emoji: '📣', labelKey: 'ob_nicheMarketing'   },
  { id: 'news',       emoji: '📰', labelKey: 'ob_nicheNews'        },
  { id: 'other',      emoji: '🎯', labelKey: 'ob_nicheOther'       },
]

function buildPlans(t: (k: string) => string): Plan[] {
  return [
    {
      id: 'starter',
      label: t('ob_planStarter'),
      price: t('ob_free'),
      priceNote: t('ob_foreverFree'),
      highlighted: false,
      cta: t('ob_startFreeBtn'),
      features: [
        { text: t('ob_feat_250credits'),  included: true  },
        { text: t('ob_feat_5projects'),   included: true  },
        { text: t('ob_feat_faceless'),    included: true  },
        { text: t('ob_feat_watermark'),   included: true  },
        { text: t('ob_feat_voiceClone'),  included: false },
        { text: t('ob_feat_autopilot'),   included: false },
      ],
    },
    {
      id: 'pro',
      label: t('ob_planPro'),
      badge: t('ob_mostPopular'),
      price: '$29',
      priceNote: t('ob_perMonth'),
      highlighted: true,
      cta: t('ob_tryProFree'),
      features: [
        { text: t('ob_feat_2000credits'), included: true },
        { text: t('ob_feat_unlimited'),   included: true },
        { text: t('ob_feat_allModules'),  included: true },
        { text: t('ob_feat_whiteLabel'),  included: true },
        { text: t('ob_feat_2voices'),     included: true },
        { text: t('ob_feat_autopilot'),   included: false },
      ],
    },
    {
      id: 'studio',
      label: t('ob_planStudio'),
      price: '$79',
      priceNote: t('ob_perMonth'),
      highlighted: false,
      cta: t('ob_tryStudioFree'),
      features: [
        { text: t('ob_feat_10000credits'),    included: true },
        { text: t('ob_feat_unlimited'),       included: true },
        { text: t('ob_feat_allModules'),      included: true },
        { text: t('ob_feat_brandKit'),        included: true },
        { text: t('ob_feat_unlimitedVoice'),  included: true },
        { text: t('ob_feat_autopilot'),       included: true },
      ],
    },
  ]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 4

function stepPercent(step: Step): number {
  return Math.round((step / TOTAL_STEPS) * 100)
}

// ── Sub-components ─────────────────────────────────────────────────────────────

/** Animated progress bar using the brand CTA gradient */
function ProgressBar({ step, t }: { step: Step; t: (k: string) => string }) {
  return (
    <div className="w-full h-[3px] bg-border rounded-full overflow-hidden">
      <div
        className="h-full bg-grad-cta rounded-full transition-all duration-500 ease-out"
        style={{ width: `${stepPercent(step)}%` }}
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={TOTAL_STEPS}
        aria-label={t('ob_stepOf').replace('{step}', String(step)).replace('{total}', String(TOTAL_STEPS))}
      />
    </div>
  )
}

/** Dot-step indicator */
function StepDots({ step }: { step: Step }) {
  return (
    <div className="flex items-center justify-center gap-2" aria-hidden="true">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => {
        const n = (i + 1) as Step
        const isActive = n === step
        const isDone   = n < step
        return (
          <div
            key={n}
            className={cn(
              'rounded-full transition-all duration-300',
              isActive && 'w-5 h-2 bg-grad-cta',
              isDone   && 'w-2 h-2 bg-primary/50',
              !isActive && !isDone && 'w-2 h-2 bg-border',
            )}
          />
        )
      })}
    </div>
  )
}

/** Check icon for plan features */
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" className={className}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

/** Minus icon for unavailable features */
function MinusIcon({ className }: { className?: string }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" aria-hidden="true" className={className}
    >
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

/** Upload / cloud icon */
function UploadIcon() {
  return (
    <svg
      width="28" height="28" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" className="text-[--text-muted]"
    >
      <polyline points="16 16 12 12 8 16" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  )
}

/** Arrow-right icon */
function ArrowRightIcon() {
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  )
}

// ── Step 1 — Welcome ───────────────────────────────────────────────────────────

interface Step1Props {
  firstName: string
  onNext: () => void
  t: (k: string) => string
}

function Step1Welcome({ firstName, onNext, t }: Step1Props) {
  return (
    <div className="animate-fade-up flex flex-col items-center text-center gap-6">
      {/* Greeting */}
      <div className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-widest text-primary opacity-80">
          {t('ob_welcomeTo')}
        </p>
        <h1 className="font-display text-2xl font-bold text-foreground tracking-tight">
          {firstName ? t('ob_heyName').replace('{name}', firstName) : t('ob_heyThere')}{' '}
          <span
            className="bg-gradient-to-r from-brand via-purple-500 to-brand-hover bg-clip-text text-transparent"
          >
            {t('ob_letsSetUp')}
          </span>
        </h1>
        <p className="font-body text-[--text-secondary] text-sm leading-relaxed max-w-xs mx-auto">
          {t('ob_welcomeDesc')}
        </p>
      </div>

      {/* Illustrated cards row */}
      <div className="w-full grid grid-cols-3 gap-2.5 my-2">
        {[
          { emoji: '🎯', labelKey: 'ob_yourNiche' },
          { emoji: '🎨', labelKey: 'ob_yourBrand' },
          { emoji: '🚀', labelKey: 'ob_yourPlan'  },
        ].map(({ emoji, labelKey }) => (
          <div
            key={labelKey}
            className="bg-muted border border-border rounded-xl py-4 px-2 flex flex-col items-center gap-2"
          >
            <span className="text-2xl" role="img" aria-label={t(labelKey)}>{emoji}</span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-[--text-muted]">
              {t(labelKey)}
            </span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <Button
        variant="primary"
        size="lg"
        fullWidth
        onClick={onNext}
        rightIcon={<ArrowRightIcon />}
      >
        {t('ob_getStarted')}
      </Button>

      <p className="font-body text-[--text-muted] text-xs">
        {t('ob_canChange')}
      </p>
    </div>
  )
}

// ── Step 2 — Niche ─────────────────────────────────────────────────────────────

interface Step2Props {
  selected: string[]
  onToggle: (id: string) => void
  onNext: () => void
  onBack: () => void
  saving: boolean
  t: (k: string) => string
}

function Step2Niche({ selected, onToggle, onNext, onBack, saving, t }: Step2Props) {
  return (
    <div className="animate-fade-up flex flex-col gap-6">
      <div className="space-y-1">
        <p className="font-mono text-xs uppercase tracking-widest text-primary opacity-80">
          {t('ob_step2of4')}
        </p>
        <h2 className="font-display text-xl font-bold text-foreground tracking-tight">
          {t('ob_whatContent')}
        </h2>
        <p className="font-body text-[--text-secondary] text-sm">
          {t('ob_selectAll')}
        </p>
      </div>

      {/* Niche grid */}
      <div className="grid grid-cols-2 gap-2.5" role="group" aria-label={t('ob_whatContent')}>
        {NICHE_OPTIONS.map(({ id, emoji, labelKey }) => {
          const isSelected = selected.includes(id)
          return (
            <button
              key={id}
              type="button"
              onClick={() => onToggle(id)}
              aria-pressed={isSelected}
              className={cn(
                'relative flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left',
                'transition-all duration-200 select-none',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                'active:scale-[0.97]',
                isSelected
                  ? 'bg-accent border-primary/60 shadow-glow-brand'
                  : 'bg-muted border-border hover:border-[--border-hover] hover:bg-card shadow-card',
              )}
            >
              <span className="text-xl shrink-0" role="img" aria-hidden="true">
                {emoji}
              </span>
              <span
                className={cn(
                  'font-display text-sm font-medium leading-tight',
                  isSelected ? 'text-primary' : 'text-foreground',
                )}
              >
                {t(labelKey)}
              </span>

              {/* Selected checkmark */}
              {isSelected && (
                <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                  <CheckIcon className="text-white w-2.5 h-2.5" />
                </span>
              )}
            </button>
          )
        })}
      </div>

      {selected.length === 0 && (
        <p className="font-body text-xs text-[--text-muted] text-center -mt-2">
          {t('ob_pickOne')}
        </p>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2 pt-1">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={onNext}
          disabled={selected.length === 0}
          loading={saving}
          rightIcon={!saving ? <ArrowRightIcon /> : undefined}
        >
          {saving ? t('ob_saving') : t('ob_continue')}
        </Button>
        <Button
          variant="ghost"
          size="md"
          fullWidth
          onClick={onBack}
          disabled={saving}
        >
          {t('ob_back')}
        </Button>
      </div>
    </div>
  )
}

// ── Step 3 — Brand Setup ───────────────────────────────────────────────────────

interface Step3Props {
  logoFile:     File | null
  logoPreview:  string | null
  brandColor:   string
  onLogoChange: (file: File | null, preview: string | null) => void
  onColorChange:(color: string) => void
  onNext:       () => void
  onSkip:       () => void
  onBack:       () => void
  saving:       boolean
  t:            (k: string) => string
}

function Step3Brand({
  logoFile,
  logoPreview,
  brandColor,
  onLogoChange,
  onColorChange,
  onNext,
  onSkip,
  onBack,
  saving,
  t,
}: Step3Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (e) => {
      onLogoChange(file, e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }, [onLogoChange])

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  return (
    <div className="animate-fade-up flex flex-col gap-6">
      <div className="space-y-1">
        <p className="font-mono text-xs uppercase tracking-widest text-primary opacity-80">
          {t('ob_step3of4')}
        </p>
        <h2 className="font-display text-xl font-bold text-foreground tracking-tight">
          {t('ob_setupBrand')}
        </h2>
        <p className="font-body text-[--text-secondary] text-sm">
          {t('ob_brandOptional')}
        </p>
      </div>

      {/* Logo dropzone */}
      <div className="flex flex-col gap-2">
        <label className="font-mono text-xs uppercase tracking-wider text-[--text-secondary]">
          {t('ob_logo')}
        </label>

        {logoPreview ? (
          // Preview state
          <div className="relative flex items-center gap-4 bg-muted border border-border rounded-xl p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoPreview}
              alt={t('ob_logoPreview')}
              className="w-14 h-14 object-contain rounded-lg border border-border bg-card"
            />
            <div className="flex-1 min-w-0">
              <p className="font-display text-sm font-medium text-foreground truncate">
                {logoFile?.name}
              </p>
              <p className="font-body text-xs text-[--text-muted] mt-0.5">
                {logoFile ? `${(logoFile.size / 1024).toFixed(0)} KB` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                onLogoChange(null, null)
                if (fileInputRef.current) fileInputRef.current.value = ''
              }}
              className="shrink-0 text-xs font-mono uppercase tracking-wider text-[--text-muted] hover:text-foreground transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring] rounded"
              aria-label={t('ob_remove')}
            >
              {t('ob_remove')}
            </button>
          </div>
        ) : (
          // Dropzone
          <div
            role="button"
            tabIndex={0}
            aria-label={t('ob_uploadOrDrag')}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-8 cursor-pointer',
              'transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              isDragOver
                ? 'border-primary bg-accent/30 scale-[1.01]'
                : 'border-border bg-muted hover:border-[--border-hover] hover:bg-card',
            )}
          >
            <UploadIcon />
            <div className="text-center">
              <p className="font-body text-sm text-foreground">
                {t('ob_uploadOrDrag')}
              </p>
              <p className="font-body text-xs text-[--text-muted] mt-0.5">
                {t('ob_uploadFormats')}
              </p>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={handleFileInput}
        />
      </div>

      {/* Brand color */}
      <div className="flex flex-col gap-2">
        <label
          htmlFor="brand-color"
          className="font-mono text-xs uppercase tracking-wider text-[--text-secondary]"
        >
          {t('ob_brandColor')}
        </label>
        <div className="flex items-center gap-3">
          {/* Native color swatch */}
          <div className="relative w-10 h-10 rounded-xl border border-border overflow-hidden shrink-0 shadow-card">
            <input
              id="brand-color"
              type="color"
              value={brandColor}
              onChange={(e) => onColorChange(e.target.value)}
              className="absolute inset-0 w-[150%] h-[150%] -translate-x-[15%] -translate-y-[15%] cursor-pointer border-none bg-transparent p-0"
              aria-label="Pick brand color"
            />
          </div>
          {/* Hex input */}
          <div className="flex-1 relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-xs text-[--text-muted] select-none pointer-events-none">
              #
            </span>
            <input
              type="text"
              value={brandColor.replace('#', '')}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6)
                if (val.length === 6) onColorChange(`#${val}`)
              }}
              maxLength={6}
              placeholder="667EEA"
              className={cn(
                'w-full h-10 rounded-xl font-mono text-sm',
                'bg-muted text-foreground placeholder:text-[--text-muted]',
                'border border-border transition-colors duration-200',
                'pl-7 pr-4 outline-none',
                'focus:border-primary focus:bg-card',
              )}
              aria-label="Brand color hex value"
            />
          </div>
          {/* Quick presets */}
          <div className="flex items-center gap-1.5 shrink-0">
            {['#6D4AFF', '#10B981', '#F59E0B', '#EF4444', '#0F172A'].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onColorChange(c)}
                style={{ backgroundColor: c }}
                className={cn(
                  'w-5 h-5 rounded-full border-2 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]',
                  brandColor.toLowerCase() === c.toLowerCase()
                    ? 'border-foreground scale-110'
                    : 'border-transparent hover:scale-110',
                )}
                aria-label={`Set brand color to ${c}`}
                aria-pressed={brandColor.toLowerCase() === c.toLowerCase()}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 pt-1">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={onNext}
          loading={saving}
          rightIcon={!saving ? <ArrowRightIcon /> : undefined}
        >
          {saving ? t('ob_saving') : t('ob_saveAndContinue')}
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="md"
            className="flex-1"
            onClick={onBack}
            disabled={saving}
          >
            {t('ob_back')}
          </Button>
          <button
            type="button"
            onClick={onSkip}
            disabled={saving}
            className="flex-1 h-9 rounded-xl font-body text-sm text-[--text-muted] hover:text-foreground transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring] disabled:opacity-40"
          >
            {t('ob_skipForNow')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Step 4 — Plan ─────────────────────────────────────────────────────────────

interface Step4Props {
  onSelectPlan: (planId: string) => void
  selecting: string | null
  t: (k: string) => string
}

function Step4Plan({ onSelectPlan, selecting, t }: Step4Props) {
  const plans = useMemo(() => buildPlans(t), [t])
  return (
    <div className="animate-fade-up flex flex-col gap-6">
      <div className="space-y-1 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-primary opacity-80">
          {t('ob_step4of4')}
        </p>
        <h2 className="font-display text-xl font-bold text-foreground tracking-tight">
          {t('ob_choosePlan')}
        </h2>
        <p className="font-body text-[--text-secondary] text-sm">
          {t('ob_startFree')}
        </p>
      </div>

      {/* Plan cards */}
      <div className="flex flex-col gap-3">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={cn(
              'relative rounded-2xl border p-5 transition-all duration-200 shadow-card hover:shadow-card-hover',
              plan.highlighted
                ? 'border-primary/50 bg-accent/20'
                : 'border-border bg-card',
            )}
          >
            {/* Popular badge */}
            {plan.badge && (
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 inline-flex items-center px-3 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-widest bg-grad-cta text-white shadow-glow-brand whitespace-nowrap">
                {plan.badge}
              </span>
            )}

            <div className="flex items-start justify-between gap-4">
              {/* Left: name + price */}
              <div className="space-y-0.5">
                <p className="font-display text-base font-semibold text-foreground">
                  {plan.label}
                </p>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display text-2xl font-bold text-foreground tracking-tight">
                    {plan.price}
                  </span>
                  <span className="font-body text-xs text-[--text-muted]">
                    {plan.priceNote}
                  </span>
                </div>
              </div>

              {/* Right: CTA */}
              <Button
                variant={plan.highlighted ? 'primary' : 'secondary'}
                size="sm"
                loading={selecting === plan.id}
                disabled={selecting !== null && selecting !== plan.id}
                onClick={() => onSelectPlan(plan.id)}
                className="shrink-0 mt-0.5"
              >
                {selecting === plan.id ? t('ob_loading') : plan.cta}
              </Button>
            </div>

            {/* Feature list */}
            <ul className="mt-4 space-y-1.5">
              {plan.features.map(({ text, included }) => (
                <li key={text} className="flex items-center gap-2">
                  {included ? (
                    <CheckIcon className="text-success shrink-0" />
                  ) : (
                    <MinusIcon className="text-[--text-muted] shrink-0" />
                  )}
                  <span
                    className={cn(
                      'font-body text-xs',
                      included ? 'text-foreground' : 'text-[--text-muted]',
                    )}
                  >
                    {text}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* View all plans */}
      <p className="text-center font-body text-xs text-[--text-muted]">
        {t('ob_notSure')}{' '}
        <a
          href="/pricing"
          className="text-primary hover:text-foreground transition-colors duration-200 underline underline-offset-2"
        >
          {t('ob_viewAllPlans')}
        </a>
      </p>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createBrowserClient()
  const { t } = useLanguage()

  // ── Global state
  const [step, setStep]           = useState<Step>(1)
  const [firstName, setFirstName] = useState('')
  const [userId, setUserId]       = useState<string | null>(null)

  // Step 2
  const [selectedNiches, setSelectedNiches] = useState<string[]>([])
  const [savingNiche, setSavingNiche]        = useState(false)

  // Step 3
  const [logoFile, setLogoFile]       = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [brandColor, setBrandColor]   = useState('#6D4AFF')
  const [savingBrand, setSavingBrand] = useState(false)

  // Step 4
  const [selectingPlan, setSelectingPlan] = useState<string | null>(null)

  // ── Fetch session on mount
  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!mounted) return
      if (!session) {
        // Not authenticated — redirect to login
        router.replace('/login')
        return
      }
      setUserId(session.user.id)

      // Derive first name from user metadata or email
      const meta      = session.user.user_metadata ?? {}
      const fullName  = meta.full_name ?? meta.name ?? ''
      const first     = (fullName as string).split(' ')[0].trim()
      setFirstName(first || (session.user.email?.split('@')[0] ?? ''))
    })()
    return () => { mounted = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Step navigation helpers
  const goNext = useCallback(() => {
    setStep((s) => Math.min(s + 1, TOTAL_STEPS) as Step)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const goBack = useCallback(() => {
    setStep((s) => Math.max(s - 1, 1) as Step)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  // ── Step 2: save niche
  const handleNicheNext = useCallback(async () => {
    if (!userId || selectedNiches.length === 0) return
    setSavingNiche(true)
    try {
      await supabase
        .from('profiles')
        .update({ niche: selectedNiches.join(',') } as never)
        .eq('id', userId)
    } catch {
      // Non-blocking: column may not exist yet — proceed anyway
    } finally {
      setSavingNiche(false)
      goNext()
    }
  }, [userId, selectedNiches, supabase, goNext])

  const toggleNiche = useCallback((id: string) => {
    setSelectedNiches((prev) =>
      prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id],
    )
  }, [])

  // ── Step 3: save brand
  const handleBrandNext = useCallback(async () => {
    if (!userId) { goNext(); return }
    setSavingBrand(true)
    try {
      // Upload logo to Supabase Storage if provided
      let logoUrl: string | undefined
      if (logoFile) {
        const ext  = logoFile.name.split('.').pop() ?? 'png'
        const path = `logos/${userId}/brand-logo.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('brand-assets')
          .upload(path, logoFile, { upsert: true, contentType: logoFile.type })
        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('brand-assets')
            .getPublicUrl(path)
          logoUrl = urlData.publicUrl
        }
      }

      // Upsert brand_kits row
      await supabase.from('brand_kits').upsert(
        {
          user_id:       userId,
          name:          'Default',
          primary_color: brandColor,
          ...(logoUrl ? { logo_url: logoUrl } : {}),
          is_default:    true,
        },
        { onConflict: 'user_id,name' },
      )
    } catch {
      // Non-blocking — proceed to next step even if storage fails
    } finally {
      setSavingBrand(false)
      goNext()
    }
  }, [userId, logoFile, brandColor, supabase, goNext])

  const handleLogoChange = useCallback((file: File | null, preview: string | null) => {
    setLogoFile(file)
    setLogoPreview(preview)
  }, [])

  // ── Step 4: plan selection
  const handleSelectPlan = useCallback(async (planId: string) => {
    setSelectingPlan(planId)
    try {
      // Starter (free) → just mark onboarding done and redirect
      if (planId === 'starter') {
        if (userId) {
          await supabase
            .from('profiles')
            .update({ onboarding_completed: true } as never)
            .eq('id', userId)
        }
        router.push('/dashboard')
        return
      }
      // Pro / Studio → redirect to pricing with plan pre-selected
      router.push(`/pricing?plan=${planId}&ref=onboarding`)
    } catch {
      router.push('/dashboard')
    } finally {
      setSelectingPlan(null)
    }
  }, [userId, supabase, router])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    /*
     * The (auth) layout constrains to max-w-md and centers on screen.
     * Step 4 (plan cards) stacks vertically so it fits comfortably in that width.
     */
    <div className="w-full space-y-6">
      {/* Logo */}
      <div className="flex flex-col items-center gap-1.5 pt-2">
        <Logo variant="full" size="md" href={false} />
      </div>

      {/* Progress */}
      <div className="space-y-3">
        <ProgressBar step={step} t={t} />
        <div className="flex items-center justify-between">
          <StepDots step={step} />
          <span className="font-mono text-[10px] uppercase tracking-widest text-[--text-muted]">
            {step} / {TOTAL_STEPS}
          </span>
        </div>
      </div>

      {/* Step card */}
      <div className="bg-card border border-border rounded-2xl p-7 shadow-card">
        {step === 1 && (
          <Step1Welcome
            firstName={firstName}
            onNext={goNext}
            t={t}
          />
        )}

        {step === 2 && (
          <Step2Niche
            selected={selectedNiches}
            onToggle={toggleNiche}
            onNext={handleNicheNext}
            onBack={goBack}
            saving={savingNiche}
            t={t}
          />
        )}

        {step === 3 && (
          <Step3Brand
            logoFile={logoFile}
            logoPreview={logoPreview}
            brandColor={brandColor}
            onLogoChange={handleLogoChange}
            onColorChange={setBrandColor}
            onNext={handleBrandNext}
            onSkip={goNext}
            onBack={goBack}
            saving={savingBrand}
            t={t}
          />
        )}

        {step === 4 && (
          <Step4Plan
            onSelectPlan={handleSelectPlan}
            selecting={selectingPlan}
            t={t}
          />
        )}
      </div>

      {/* Footer note */}
      <p className="text-center font-body text-xs text-[--text-muted] pb-4">
        {t('ob_legalAgree')}{' '}
        <a href="/legal/terms" className="underline underline-offset-2 hover:text-foreground transition-colors duration-200">
          {t('ob_terms')}
        </a>{' '}
        {t('ob_and')}{' '}
        <a href="/legal/privacy" className="underline underline-offset-2 hover:text-foreground transition-colors duration-200">
          {t('ob_privacy')}
        </a>
        .
      </p>
    </div>
  )
}
