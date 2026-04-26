'use client'

import { useState, useEffect, useRef } from 'react'
import { useLanguage } from '@/lib/i18n'
import { useRouter } from 'next/navigation'
import { startMotionDesignGeneration, getPublicVoices, uploadBrandLogo } from '@/lib/api'
import { useVideoStatus } from '@/hooks/use-video-status'
import { createBrowserClient } from '@/lib/supabase'
import { toast } from '@/components/ui/toast'
import type { CreateMotionDesignPayload } from '@/lib/api'

// ── Types ──────────────────────────────────────────────────────────────────

type MDFormat   = '16_9' | '9_16' | '1_1'
type MDDuration = '6s' | '15s' | '30s' | '60s' | '90s' | '120s' | '180s' | '300s' | 'auto'

interface BrandConfig {
  primary_color:   string
  secondary_color?: string
  logo_url?:        string
}

interface WizardState {
  title:    string
  brief:    string
  brand:    BrandConfig
  format:   MDFormat
  duration: MDDuration
  voiceId:  string
  voiceName: string
}

interface VoiceItem {
  id: string
  name: string
  gender?: string
  accent?: string
}

// ── Data ───────────────────────────────────────────────────────────────────

const FORMATS: Array<{ id: MDFormat; label: string; desc: string; ratio: string }> = [
  { id: '16_9', label: '16:9', desc: 'YouTube / Linkedin',   ratio: '16/9' },
  { id: '9_16', label: '9:16', desc: 'Stories / TikTok',     ratio: '9/16' },
  { id: '1_1',  label: '1:1',  desc: 'Instagram / Square',  ratio: '1/1'  },
]

const DURATIONS: Array<{ id: MDDuration; label: string }> = [
  { id: '15s',  label: '15s'   },
  { id: '30s',  label: '30s'   },
  { id: '60s',  label: '1 min' },
  { id: '90s',  label: '90s'   },
  { id: '120s', label: '2 min' },
  { id: 'auto', label: 'Auto'  },
]

const PIPELINE_STEPS = [
  { key: 'storyboard', label: 'md_sceneGen', progress: 25 },
  { key: 'audio',      label: 'md_voiceStep',                     progress: 50 },
  { key: 'assembly',   label: 'md_renderStep',         progress: 88 },
  { key: 'done',       label: 'md_videoReadyStep',                progress: 100 },
]

// STEP_LABELS moved inside component

// ── WCAG helpers ───────────────────────────────────────────────────────────

function hexToLuminance(hex: string): number {
  const clean = hex.replace('#', '')
  if (clean.length !== 6) return 0
  const r = parseInt(clean.slice(0, 2), 16) / 255
  const g = parseInt(clean.slice(2, 4), 16) / 255
  const b = parseInt(clean.slice(4, 6), 16) / 255
  const lin = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function wcagContrastRatio(hex1: string, hex2 = '#ffffff'): number {
  const l1 = hexToLuminance(hex1)
  const l2 = hexToLuminance(hex2)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

// ── Step 1 — Brief ─────────────────────────────────────────────────────────

function StepBrief({
  title, brief, onUpdate, onNext,
}: {
  title: string
  brief: string
  onUpdate: (field: 'title' | 'brief', value: string) => void
  onNext: () => void
}) {
  const { t } = useLanguage()
  const canContinue = title.trim().length > 0 && brief.trim().length >= 20
  return (
    <div>
      <div className="mb-3">
        <span className="inline-flex items-center gap-2 bg-clyro-purple/10 border border-clyro-purple/20 text-clyro-purple text-xs font-mono px-3 py-1 rounded-full">
          F2 Motion Design
        </span>
      </div>
      <h2 className="font-display text-lg font-semibold text-foreground mb-1">{t('md_creativeBrief')}</h2>
      <p className="font-body text-sm text-muted-foreground mb-5">
        {t('md_briefSubtitle')}
      </p>
      <div className="mb-4">
        <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2 block">
          {t('md_videoTitle')}
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => onUpdate('title', e.target.value)}
          placeholder={t('md_titlePlaceholder')}
          maxLength={200}
          className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground font-body text-sm placeholder:text-muted-foreground focus:outline-none focus:border-clyro-purple"
        />
      </div>
      <div className="mb-5">
        <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2 block">
          {t('md_brief')} ({brief.length}/3000)
        </label>
        <textarea
          value={brief}
          onChange={(e) => onUpdate('brief', e.target.value)}
          placeholder={t('md_briefPlaceholder')}
          maxLength={3000}
          rows={7}
          className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground font-body text-sm placeholder:text-muted-foreground focus:outline-none focus:border-clyro-purple resize-none"
        />
      </div>
      <button
        onClick={onNext}
        disabled={!canContinue}
        className="bg-clyro-purple text-white font-display font-semibold px-6 py-2.5 rounded-xl disabled:opacity-40 hover:opacity-90 transition-opacity text-sm"
      >
        Suivant →
      </button>
    </div>
  )
}

// ── Step 2 — Brand ─────────────────────────────────────────────────────────

function StepBrand({
  brand, onUpdate, onNext, onBack,
}: {
  brand: BrandConfig
  onUpdate: (brand: BrandConfig) => void
  onNext: () => void
  onBack: () => void
}) {
  const { t } = useLanguage()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const contrastRatio = wcagContrastRatio(brand.primary_color)
  const wcagOk = contrastRatio >= 4.5

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Session expired')
      const logoUrl = await uploadBrandLogo(file, session.user.id)
      onUpdate({ ...brand, logo_url: logoUrl })
      toast.success(t('md_logoUploaded'))
    } catch {
      toast.error(t('md_logoError'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <h2 className="font-display text-lg font-semibold text-foreground mb-4">{t('md_brandIdentity')}</h2>
      <p className="font-body text-sm text-muted-foreground mb-5">
        {t('md_brandSubtitle')}
      </p>
      <div className="space-y-4 mb-6">
        {/* Logo */}
        <div>
          <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2 block">
            {t('md_logoLabel')}
          </label>
          <div className="flex items-center gap-3">
            {brand.logo_url ? (
              <div className="relative w-16 h-16 rounded-xl border border-border bg-muted overflow-hidden flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={brand.logo_url} alt="Logo" className="max-w-full max-h-full object-contain p-1" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-xl border-2 border-dashed border-border bg-muted flex items-center justify-center text-muted-foreground text-xs text-center leading-tight p-1">
                PNG / SVG
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" onChange={handleLogoUpload} className="hidden" />
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="font-display font-semibold px-4 py-2 rounded-xl border border-border text-sm text-foreground hover:bg-muted disabled:opacity-40"
              >
                {uploading ? t('md_uploading') : brand.logo_url ? t('md_change') : t('md_chooseFile')}
              </button>
              {brand.logo_url && (
                <button type="button" onClick={() => onUpdate({ ...brand, logo_url: undefined })} className="text-xs text-muted-foreground hover:text-red-400 text-left">
                  {t('md_remove')}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Primary color */}
        <div>
          <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2 block">
            Couleur principale *
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={brand.primary_color}
              onChange={(e) => onUpdate({ ...brand, primary_color: e.target.value })}
              className="w-12 h-12 rounded-xl border border-border bg-muted cursor-pointer"
            />
            <input
              type="text"
              value={brand.primary_color}
              onChange={(e) => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) onUpdate({ ...brand, primary_color: e.target.value }) }}
              className="w-32 bg-muted border border-border rounded-xl px-3 py-2 text-foreground font-mono text-sm focus:outline-none focus:border-clyro-purple"
            />
            <span className={`text-xs font-mono px-2 py-1 rounded-lg ${wcagOk ? 'bg-green-900/40 text-green-400' : 'bg-amber-900/40 text-amber-400'}`}>
              {wcagOk ? `✓ WCAG AA (${contrastRatio.toFixed(1)}:1)` : `⚠ Contraste faible (${contrastRatio.toFixed(1)}:1)`}
            </span>
          </div>
        </div>

        {/* Secondary */}
        <div>
          <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2 block">
            Couleur secondaire (optionnel)
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={brand.secondary_color ?? '#ffffff'}
              onChange={(e) => onUpdate({ ...brand, secondary_color: e.target.value })}
              className="w-12 h-12 rounded-xl border border-border bg-muted cursor-pointer"
            />
            <input
              type="text"
              value={brand.secondary_color ?? ''}
              onChange={(e) => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) onUpdate({ ...brand, secondary_color: e.target.value || undefined }) }}
              placeholder="#ffffff"
              className="w-32 bg-muted border border-border rounded-xl px-3 py-2 text-foreground font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:border-clyro-purple"
            />
          </div>
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={onBack} className="font-display font-semibold px-4 py-2.5 rounded-xl border border-border text-muted-foreground hover:bg-muted text-sm">{t('md_back')}</button>
        <button onClick={onNext} className="bg-clyro-purple text-white font-display font-semibold px-6 py-2.5 rounded-xl hover:opacity-90 transition-opacity text-sm">{t('md_next')}</button>
      </div>
    </div>
  )
}

// ── Step 3 — Format + Duration ─────────────────────────────────────────────

function StepFormat({
  format, duration, onUpdate, onNext, onBack,
}: {
  format: MDFormat
  duration: MDDuration
  onUpdate: (field: 'format' | 'duration', value: string) => void
  onNext: () => void
  onBack: () => void
}) {
  const { t } = useLanguage()
  return (
    <div>
      <h2 className="font-display text-lg font-semibold text-foreground mb-4">{t('md_formatDuration')}</h2>
      <div className="mb-5">
        <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-3 block">{t('md_format')}</label>
        <div className="grid grid-cols-3 gap-3">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              onClick={() => onUpdate('format', f.id)}
              className={`border rounded-xl p-4 text-center transition-all ${format === f.id ? 'border-clyro-purple bg-clyro-purple/5 ring-1 ring-clyro-purple/30' : 'border-border bg-muted hover:border-clyro-purple/40'}`}
            >
              <div className={`mx-auto mb-2 bg-clyro-purple/20 rounded-md`} style={{ width: f.id === '9_16' ? 24 : f.id === '1_1' ? 32 : 48, height: f.id === '9_16' ? 42 : 32 }} />
              <p className="font-display font-bold text-foreground text-sm">{f.label}</p>
              <p className="font-body text-xs text-muted-foreground mt-0.5">{f.desc}</p>
            </button>
          ))}
        </div>
      </div>
      <div className="mb-6">
        <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-3 block">{t('md_duration')}</label>
        <div className="flex flex-wrap gap-2">
          {DURATIONS.map((d) => (
            <button
              key={d.id}
              onClick={() => onUpdate('duration', d.id)}
              className={`px-4 py-2 rounded-xl border font-display font-semibold text-sm transition-all ${duration === d.id ? 'border-clyro-purple bg-clyro-purple/10 text-clyro-purple' : 'border-border bg-muted text-muted-foreground hover:border-clyro-purple/40'}`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={onBack} className="font-display font-semibold px-4 py-2.5 rounded-xl border border-border text-muted-foreground hover:bg-muted text-sm">{t('md_back')}</button>
        <button onClick={onNext} className="bg-clyro-purple text-white font-display font-semibold px-6 py-2.5 rounded-xl hover:opacity-90 transition-opacity text-sm">{t('md_next')}</button>
      </div>
    </div>
  )
}

// ── Step 4 — Voice ─────────────────────────────────────────────────────────

function StepVoice({
  selectedId, onSelect, onNext, onBack,
}: {
  selectedId: string
  onSelect: (id: string, name: string) => void
  onNext: () => void
  onBack: () => void
}) {
  const { t } = useLanguage()
  const [voices, setVoices] = useState<VoiceItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPublicVoices()
      .then(({ voices }) => setVoices(voices as VoiceItem[]))
      .catch((err) => toast.error(err instanceof Error ? err.message : t('md_voiceLoadError')))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <h2 className="font-display text-lg font-semibold text-foreground mb-2">{t('md_voiceOver')}</h2>
      <p className="font-body text-sm text-muted-foreground mb-4">
        {t('md_voiceSubtitle')}
      </p>
      {loading ? (
        <div className="space-y-2 mb-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto mb-4 pr-1">
          <button
            onClick={() => onSelect('', '')}
            className={`w-full bg-muted border rounded-xl px-4 py-3 text-left transition-all ${selectedId === '' ? 'border-clyro-purple bg-clyro-purple/5' : 'border-border hover:border-clyro-purple/40'}`}
          >
            <p className="font-display font-semibold text-sm text-foreground">🔇 {t('md_noVoice')}</p>
          </button>
          {voices.map((v) => (
            <button
              key={v.id}
              onClick={() => onSelect(v.id, v.name)}
              className={`w-full bg-muted border rounded-xl px-4 py-3 text-left transition-all ${selectedId === v.id ? 'border-clyro-purple bg-clyro-purple/5' : 'border-border hover:border-clyro-purple/40'}`}
            >
              <div className="flex items-center justify-between">
                <p className="font-display font-semibold text-sm text-foreground">{v.name}</p>
                <span className="font-mono text-xs text-muted-foreground">{v.gender} · {v.accent}</span>
              </div>
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-3">
        <button onClick={onBack} className="font-display font-semibold px-4 py-2.5 rounded-xl border border-border text-muted-foreground hover:bg-muted text-sm">{t('md_back')}</button>
        <button onClick={onNext} className="bg-clyro-purple text-white font-display font-semibold px-6 py-2.5 rounded-xl hover:opacity-90 transition-opacity text-sm">{t('md_next')}</button>
      </div>
    </div>
  )
}

// ── Step 5 — Confirm ───────────────────────────────────────────────────────

function StepConfirm({
  state, onLaunch, onBack, launching,
}: {
  state: WizardState
  onLaunch: () => void
  onBack: () => void
  launching: boolean
}) {
  const { t } = useLanguage()
  const formatLabel = FORMATS.find((f) => f.id === state.format)
  return (
    <div>
      <h2 className="font-display text-lg font-semibold text-foreground mb-4">{t('md_confirm')}</h2>
      <div className="bg-muted border border-border rounded-xl p-5 space-y-3 mb-5">
        <Row label={t('md_videoTitle')}    value={state.title} />
        <Row label={t('md_format')}   value={`${formatLabel?.label ?? state.format} — ${formatLabel?.desc ?? ''}`} />
        <Row label={t('md_duration')}    value={state.duration} />
        <Row label={t('md_primaryColor')}  value={state.brand.primary_color} />
        <Row label="Logo"     value={state.brand.logo_url ? '✓' : '—'} />
        <Row label={t('md_voiceOver')} value={state.voiceName || t('md_noVoice')} />
      </div>
      <div className="bg-clyro-purple/5 border border-clyro-purple/20 rounded-xl p-4 mb-5">
        <p className="font-body text-sm text-clyro-purple">
          {t('md_confirmDesc')}
        </p>
      </div>
      <div className="flex gap-3">
        <button onClick={onBack} disabled={launching} className="font-display font-semibold px-4 py-2.5 rounded-xl border border-border text-muted-foreground hover:bg-muted text-sm disabled:opacity-50">{t('md_back')}</button>
        <button
          onClick={onLaunch}
          disabled={launching}
          className="bg-clyro-purple text-white font-display font-semibold px-6 py-2.5 rounded-xl hover:opacity-90 transition-opacity text-sm disabled:opacity-60"
        >
          {launching ? t('md_launching') : t('md_generateVideo')}
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

// ── Step 6 — Generating ────────────────────────────────────────────────────

function StepGenerating({ videoId, onReset }: { videoId: string; onReset: () => void }) {
  const { t } = useLanguage()
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
        {isError ? t('md_genError') : isDone ? t('md_videoReady') : t('md_generating')}
      </h2>
      <div className="h-2 bg-muted rounded-full mb-6 overflow-hidden">
        <div className="h-full bg-clyro-purple rounded-full transition-all duration-700" style={{ width: `${Math.max(progress, 5)}%` }} />
      </div>
      <div className="space-y-3 mb-6">
        {PIPELINE_STEPS.map((pStep) => {
          const isActive   = status === pStep.key
          const isComplete = progress >= pStep.progress
          return (
            <div key={pStep.key} className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-full border flex items-center justify-center text-xs font-mono transition-all ${
                isComplete ? 'bg-clyro-purple border-clyro-purple text-white' : isActive ? 'border-clyro-purple text-clyro-purple' : 'border-border text-muted-foreground'
              }`}>
                {isComplete ? '✓' : '·'}
              </div>
              <span className={`font-body text-sm ${isComplete ? 'text-foreground' : 'text-muted-foreground'}`}>{t(pStep.label)}</span>
              {isActive && !isComplete && <span className="font-mono text-xs text-clyro-purple animate-pulse">{t('md_inProgress')}</span>}
            </div>
          )
        })}
      </div>
      {isError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4">
          <p className="text-red-400 text-sm font-body">{errorMessage ?? t('md_errorOccurred')}</p>
        </div>
      )}
      {isDone && outputUrl && (
        <a
          href={outputUrl}
          download
          className="inline-flex items-center gap-2 bg-clyro-purple/10 border border-clyro-purple/20 text-clyro-purple font-display font-semibold px-5 py-2.5 rounded-xl hover:bg-clyro-purple/20 text-sm transition-colors mb-3"
        >
          {t('md_downloadVideo')}
        </a>
      )}
      {isDone && <p className="font-body text-sm text-muted-foreground mt-2">{t('md_redirecting')}</p>}
      {isError && (
        <button onClick={onReset} className="font-display font-semibold px-5 py-2.5 rounded-xl border border-border text-foreground hover:bg-muted text-sm mt-2">
          {t('md_tryAgain')}
        </button>
      )}
    </div>
  )
}

// ── Main Wizard ────────────────────────────────────────────────────────────

export function MotionDesignWizard() {
  const { t } = useLanguage()
  const STEP_LABELS = [t('md_brief'), t('md_brand'), t('md_format'), t('md_voice'), t('md_confirm')]
  const [step, setStep]       = useState<1 | 2 | 3 | 4 | 5 | 6>(1)
  const [launching, setLaunching] = useState(false)
  const [videoId, setVideoId]     = useState<string | null>(null)
  const [state, setState]         = useState<WizardState>({
    title:     '',
    brief:     '',
    brand:     { primary_color: '#7C3AED' },
    format:    '16_9',
    duration:  '30s',
    voiceId:   '',
    voiceName: '',
  })

  function updateState<K extends keyof WizardState>(key: K, value: WizardState[K]) {
    setState((prev) => ({ ...prev, [key]: value }))
  }

  async function handleLaunch() {
    if (!state.title.trim() || !state.brief.trim()) return
    setLaunching(true)
    try {
      const payload: CreateMotionDesignPayload = {
        title:    state.title,
        brief:    state.brief,
        format:   state.format,
        duration: state.duration,
        brand_config: state.brand,
        voice_id: state.voiceId || undefined,
      }
      const { video_id } = await startMotionDesignGeneration(payload)
      setVideoId(video_id)
      setStep(6)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('md_launchError'))
    } finally {
      setLaunching(false)
    }
  }

  function reset() {
    setStep(1)
    setVideoId(null)
    setState({ title: '', brief: '', brand: { primary_color: '#7C3AED' }, format: '16_9', duration: '30s', voiceId: '', voiceName: '' })
  }

  return (
    <div className="max-w-2xl">
      {step < 6 && (
        <div className="flex items-center gap-1.5 mb-8 flex-wrap">
          {STEP_LABELS.map((label, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className={`w-7 h-7 rounded-full border font-mono text-xs flex items-center justify-center transition-all ${
                step > i + 1 ? 'bg-clyro-purple border-clyro-purple text-white' : step === i + 1 ? 'border-clyro-purple text-clyro-purple bg-clyro-purple/10' : 'border-border text-muted-foreground'
              }`}>
                {step > i + 1 ? '✓' : i + 1}
              </div>
              {i < STEP_LABELS.length - 1 && <div className={`h-px w-4 ${step > i + 1 ? 'bg-clyro-purple' : 'bg-border'}`} />}
            </div>
          ))}
          <span className="font-mono text-xs text-muted-foreground ml-2">{STEP_LABELS[(step as number) - 1]}</span>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-6">
        {step === 1 && (
          <StepBrief
            title={state.title}
            brief={state.brief}
            onUpdate={(field, value) => updateState(field, value)}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <StepBrand
            brand={state.brand}
            onUpdate={(brand) => updateState('brand', brand)}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <StepFormat
            format={state.format}
            duration={state.duration}
            onUpdate={(field, value) => updateState(field as 'format' | 'duration', value as MDFormat & MDDuration)}
            onNext={() => setStep(4)}
            onBack={() => setStep(2)}
          />
        )}
        {step === 4 && (
          <StepVoice
            selectedId={state.voiceId}
            onSelect={(id, name) => { updateState('voiceId', id); updateState('voiceName', name) }}
            onNext={() => setStep(5)}
            onBack={() => setStep(3)}
          />
        )}
        {step === 5 && (
          <StepConfirm
            state={state}
            onLaunch={handleLaunch}
            onBack={() => setStep(4)}
            launching={launching}
          />
        )}
        {step === 6 && videoId && <StepGenerating videoId={videoId} onReset={reset} />}
      </div>
    </div>
  )
}
