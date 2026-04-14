'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { startMotionGeneration, getVoices, uploadBrandLogo } from '@/lib/api'
import { useVideoStatus } from '@/hooks/use-video-status'
import { createBrowserClient } from '@/lib/supabase'
import { toast } from '@/components/ui/toast'
import type { MotionStyle, VideoFormat, VideoDuration } from '@clyro/shared'

// ── Types ──────────────────────────────────────────────────────────────────

interface BrandConfig {
  primary_color: string
  secondary_color?: string
  font_family?: string
  logo_url?: string
}

interface WizardState {
  title: string
  brief: string
  brand: BrandConfig
  format: VideoFormat
  duration: VideoDuration
  style: MotionStyle | null
  voiceId: string
  voiceName: string
}

interface VoiceItem {
  id: string
  name: string
  gender?: string
  accent?: string
}

// ── Data ───────────────────────────────────────────────────────────────────

const MOTION_STYLES: Array<{ id: MotionStyle; emoji: string; label: string; desc: string }> = [
  { id: 'corporate', emoji: '🏢', label: 'Corporate',  desc: 'Professionnel et épuré' },
  { id: 'dynamique', emoji: '⚡', label: 'Dynamique',  desc: 'Énergique et impactant' },
  { id: 'luxe',      emoji: '✨', label: 'Luxe',       desc: 'Premium et élégant' },
  { id: 'fun',       emoji: '🎉', label: 'Fun',        desc: 'Coloré et engageant' },
]

const FORMATS: Array<{ id: VideoFormat; label: string; desc: string }> = [
  { id: '9:16', label: '9:16', desc: 'Stories / TikTok' },
  { id: '1:1',  label: '1:1',  desc: 'Instagram carré' },
  { id: '16:9', label: '16:9', desc: 'YouTube / pubs' },
]

const DURATIONS: Array<{ id: VideoDuration; label: string }> = [
  { id: '6s',  label: '6s'  },
  { id: '15s', label: '15s' },
  { id: '30s', label: '30s' },
  { id: '60s', label: '60s' },
]

const PIPELINE_STEPS = [
  { key: 'storyboard', label: 'Analyse du brief',   progress: 20 },
  { key: 'visuals',    label: 'Génération visuels', progress: 55 },
  { key: 'audio',      label: 'Voix off',           progress: 72 },
  { key: 'assembly',   label: 'Assemblage Motion',  progress: 90 },
  { key: 'done',       label: 'Vidéo prête !',      progress: 100 },
]

const STEP_LABELS = ['Brief', 'Marque', 'Format', 'Style', 'Voix', 'Confirmer']

// ── Step 1 — Brief ─────────────────────────────────────────────────────────

function StepBrief({
  title, brief, onUpdate, onNext,
}: {
  title: string
  brief: string
  onUpdate: (field: 'title' | 'brief', value: string) => void
  onNext: () => void
}) {
  const canContinue = title.trim().length > 0 && brief.trim().length >= 20
  return (
    <div>
      <h2 className="font-display text-lg font-semibold text-foreground mb-4">Brief créatif</h2>
      <div className="mb-4">
        <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2 block">
          Titre de la publicité
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => onUpdate('title', e.target.value)}
          placeholder="Ex : Lancement produit Bakolo — Janvier 2026"
          maxLength={200}
          className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground font-body text-sm placeholder:text-muted-foreground focus:outline-none focus:border-clyro-purple"
        />
      </div>
      <div className="mb-5">
        <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2 block">
          Brief ({brief.length}/2000 — min 20 caractères)
        </label>
        <textarea
          value={brief}
          onChange={(e) => onUpdate('brief', e.target.value)}
          placeholder="Décris ta pub : produit, message clé, public cible, ton souhaité, call-to-action..."
          maxLength={2000}
          rows={6}
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
  const lighter = Math.max(l1, l2)
  const darker  = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
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
      if (!session) throw new Error('Session expirée')
      const logoUrl = await uploadBrandLogo(file, session.user.id)
      onUpdate({ ...brand, logo_url: logoUrl })
      toast.success('Logo uploadé')
    } catch {
      toast.error('Erreur lors de l\'upload du logo')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <h2 className="font-display text-lg font-semibold text-foreground mb-4">Identité de marque</h2>
      <div className="space-y-4 mb-6">
        {/* Logo upload */}
        <div>
          <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2 block">
            Logo (optionnel)
          </label>
          <div className="flex items-center gap-3">
            {brand.logo_url ? (
              <div className="relative w-16 h-16 rounded-xl border border-border bg-muted overflow-hidden flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={brand.logo_url} alt="Logo" className="max-w-full max-h-full object-contain p-1" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-xl border-2 border-dashed border-border bg-muted flex items-center justify-center text-muted-foreground text-xs">
                PNG/SVG
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/svg+xml,image/jpeg,image/webp"
              onChange={handleLogoUpload}
              className="hidden"
            />
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="font-display font-semibold px-4 py-2 rounded-xl border border-border text-sm text-foreground hover:bg-muted disabled:opacity-40"
              >
                {uploading ? 'Upload…' : brand.logo_url ? 'Changer' : 'Choisir un fichier'}
              </button>
              {brand.logo_url && (
                <button
                  type="button"
                  onClick={() => onUpdate({ ...brand, logo_url: undefined })}
                  className="text-xs text-muted-foreground hover:text-red-400 text-left"
                >
                  Supprimer
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Primary color + WCAG */}
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
              onChange={(e) => {
                if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value))
                  onUpdate({ ...brand, primary_color: e.target.value })
              }}
              className="w-32 bg-muted border border-border rounded-xl px-3 py-2 text-foreground font-mono text-sm focus:outline-none focus:border-clyro-purple"
            />
            <span className={`text-xs font-mono px-2 py-1 rounded-lg ${wcagOk ? 'bg-green-900/40 text-green-400' : 'bg-amber-900/40 text-amber-400'}`}>
              {wcagOk ? `✓ WCAG AA (${contrastRatio.toFixed(1)}:1)` : `⚠ Contraste faible (${contrastRatio.toFixed(1)}:1 — min 4.5)`}
            </span>
          </div>
        </div>

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
              onChange={(e) => {
                if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value))
                  onUpdate({ ...brand, secondary_color: e.target.value || undefined })
              }}
              placeholder="#ffffff"
              className="w-32 bg-muted border border-border rounded-xl px-3 py-2 text-foreground font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:border-clyro-purple"
            />
          </div>
        </div>
        <div>
          <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2 block">
            Police (optionnel)
          </label>
          <input
            type="text"
            value={brand.font_family ?? ''}
            onChange={(e) => onUpdate({ ...brand, font_family: e.target.value || undefined })}
            placeholder="Ex : Syne, Inter, Poppins..."
            className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground font-body text-sm placeholder:text-muted-foreground focus:outline-none focus:border-clyro-purple"
          />
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={onBack} className="font-display font-semibold px-4 py-2.5 rounded-xl border border-border text-muted-foreground hover:bg-muted text-sm">
          ← Retour
        </button>
        <button onClick={onNext} className="bg-clyro-purple text-white font-display font-semibold px-6 py-2.5 rounded-xl hover:opacity-90 transition-opacity text-sm">
          Suivant →
        </button>
      </div>
    </div>
  )
}

// ── Step 3 — Format + Duration ─────────────────────────────────────────────

function StepFormat({
  format, duration, onUpdate, onNext, onBack,
}: {
  format: VideoFormat
  duration: VideoDuration
  onUpdate: (field: 'format' | 'duration', value: string) => void
  onNext: () => void
  onBack: () => void
}) {
  return (
    <div>
      <h2 className="font-display text-lg font-semibold text-foreground mb-4">Format & Durée</h2>
      <div className="mb-5">
        <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-3 block">Format</label>
        <div className="grid grid-cols-3 gap-3">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              onClick={() => onUpdate('format', f.id)}
              className={`border rounded-xl p-4 text-center transition-all ${
                format === f.id
                  ? 'border-clyro-purple bg-clyro-purple/5 ring-1 ring-clyro-purple/30'
                  : 'border-border bg-muted hover:border-clyro-purple/40'
              }`}
            >
              <p className="font-display font-bold text-foreground text-sm">{f.label}</p>
              <p className="font-body text-xs text-muted-foreground mt-1">{f.desc}</p>
            </button>
          ))}
        </div>
      </div>
      <div className="mb-6">
        <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-3 block">Durée</label>
        <div className="flex gap-3">
          {DURATIONS.map((d) => (
            <button
              key={d.id}
              onClick={() => onUpdate('duration', d.id)}
              className={`flex-1 py-2.5 rounded-xl border font-display font-semibold text-sm transition-all ${
                duration === d.id
                  ? 'border-clyro-purple bg-clyro-purple/10 text-clyro-purple'
                  : 'border-border bg-muted text-muted-foreground hover:border-clyro-purple/40'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={onBack} className="font-display font-semibold px-4 py-2.5 rounded-xl border border-border text-muted-foreground hover:bg-muted text-sm">
          ← Retour
        </button>
        <button onClick={onNext} className="bg-clyro-purple text-white font-display font-semibold px-6 py-2.5 rounded-xl hover:opacity-90 transition-opacity text-sm">
          Suivant →
        </button>
      </div>
    </div>
  )
}

// ── Step 4 — Style ─────────────────────────────────────────────────────────

function StepStyle({
  selected, onSelect, onNext, onBack,
}: {
  selected: MotionStyle | null
  onSelect: (s: MotionStyle) => void
  onNext: () => void
  onBack: () => void
}) {
  return (
    <div>
      <h2 className="font-display text-lg font-semibold text-foreground mb-4">Style visuel</h2>
      <div className="grid grid-cols-2 gap-4 mb-6">
        {MOTION_STYLES.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`bg-muted border rounded-xl p-5 text-left transition-all ${
              selected === s.id
                ? 'border-clyro-purple bg-clyro-purple/5 ring-1 ring-clyro-purple/30'
                : 'border-border hover:border-clyro-purple/40'
            }`}
          >
            <span className="text-3xl mb-2 block">{s.emoji}</span>
            <p className="font-display font-semibold text-foreground text-sm">{s.label}</p>
            <p className="font-body text-xs text-muted-foreground mt-1">{s.desc}</p>
          </button>
        ))}
      </div>
      <div className="flex gap-3">
        <button onClick={onBack} className="font-display font-semibold px-4 py-2.5 rounded-xl border border-border text-muted-foreground hover:bg-muted text-sm">
          ← Retour
        </button>
        <button
          onClick={onNext}
          disabled={!selected}
          className="bg-clyro-purple text-white font-display font-semibold px-6 py-2.5 rounded-xl disabled:opacity-40 hover:opacity-90 transition-opacity text-sm"
        >
          Suivant →
        </button>
      </div>
    </div>
  )
}

// ── Step 5 — Voice ─────────────────────────────────────────────────────────

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

  useEffect(() => {
    getVoices()
      .then(({ public: pub }) => setVoices(pub as VoiceItem[]))
      .catch(() => toast.error('Impossible de charger les voix'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <h2 className="font-display text-lg font-semibold text-foreground mb-4">Voix off</h2>
      {loading ? (
        <div className="space-y-2 mb-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto mb-4 pr-1">
          <button
            onClick={() => onSelect('', 'Pas de voix off')}
            className={`w-full bg-muted border rounded-xl px-4 py-3 text-left transition-all ${
              selectedId === '' ? 'border-clyro-purple bg-clyro-purple/5' : 'border-border hover:border-clyro-purple/40'
            }`}
          >
            <p className="font-display font-semibold text-sm text-foreground">🔇 Pas de voix off</p>
          </button>
          {voices.map((v) => (
            <button
              key={v.id}
              onClick={() => onSelect(v.id, v.name)}
              className={`w-full bg-muted border rounded-xl px-4 py-3 text-left transition-all ${
                selectedId === v.id ? 'border-clyro-purple bg-clyro-purple/5' : 'border-border hover:border-clyro-purple/40'
              }`}
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
        <button onClick={onBack} className="font-display font-semibold px-4 py-2.5 rounded-xl border border-border text-muted-foreground hover:bg-muted text-sm">
          ← Retour
        </button>
        <button onClick={onNext} className="bg-clyro-purple text-white font-display font-semibold px-6 py-2.5 rounded-xl hover:opacity-90 transition-opacity text-sm">
          Suivant →
        </button>
      </div>
    </div>
  )
}

// ── Step 6 — Confirm ───────────────────────────────────────────────────────

function StepConfirm({
  state, onLaunch, onBack, launching,
}: {
  state: WizardState
  onLaunch: () => void
  onBack: () => void
  launching: boolean
}) {
  const styleLabel  = MOTION_STYLES.find((s) => s.id === state.style)?.label ?? state.style
  const formatLabel = FORMATS.find((f) => f.id === state.format)?.desc ?? state.format
  return (
    <div>
      <h2 className="font-display text-lg font-semibold text-foreground mb-4">Confirmer</h2>
      <div className="bg-muted border border-border rounded-xl p-5 space-y-3 mb-5">
        <Row label="Titre"    value={state.title} />
        <Row label="Style"    value={styleLabel ?? ''} />
        <Row label="Format"   value={`${state.format} — ${formatLabel}`} />
        <Row label="Durée"    value={state.duration} />
        <Row label="Couleur"  value={state.brand.primary_color} />
        <Row label="Voix off" value={state.voiceName || 'Pas de voix off'} />
      </div>
      <p className="font-body text-sm text-muted-foreground mb-5">
        La génération prend 2–5 minutes. Tu recevras un email quand ta vidéo est prête.
      </p>
      <div className="flex gap-3">
        <button onClick={onBack} disabled={launching} className="font-display font-semibold px-4 py-2.5 rounded-xl border border-border text-muted-foreground hover:bg-muted text-sm disabled:opacity-50">
          ← Retour
        </button>
        <button
          onClick={onLaunch}
          disabled={launching}
          className="bg-clyro-purple text-white font-display font-semibold px-6 py-2.5 rounded-xl hover:opacity-90 transition-opacity text-sm disabled:opacity-60"
        >
          {launching ? 'Lancement...' : '🚀 Générer la publicité'}
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

// ── Step 7 — Generating ────────────────────────────────────────────────────

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
        {isError ? '❌ Erreur de génération' : isDone ? '✅ Publicité prête !' : '⏳ Génération en cours...'}
      </h2>
      <div className="h-2 bg-muted rounded-full mb-6 overflow-hidden">
        <div
          className="h-full bg-clyro-purple rounded-full transition-all duration-700"
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
                  ? 'bg-clyro-purple border-clyro-purple text-white'
                  : isActive
                  ? 'border-clyro-purple text-clyro-purple'
                  : 'border-border text-muted-foreground'
              }`}>
                {isComplete ? '✓' : '·'}
              </div>
              <span className={`font-body text-sm ${isComplete ? 'text-foreground' : 'text-muted-foreground'}`}>
                {pStep.label}
              </span>
              {isActive && !isComplete && (
                <span className="font-mono text-xs text-clyro-purple animate-pulse">en cours</span>
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
          className="inline-flex items-center gap-2 bg-clyro-purple/10 border border-clyro-purple/20 text-clyro-purple font-display font-semibold px-5 py-2.5 rounded-xl hover:bg-clyro-purple/20 text-sm transition-colors mb-3"
        >
          ↓ Télécharger la vidéo
        </a>
      )}
      {isDone && <p className="font-body text-sm text-muted-foreground mt-2">Redirection vers l&apos;historique...</p>}
      {isError && (
        <button onClick={onReset} className="font-display font-semibold px-5 py-2.5 rounded-xl border border-border text-foreground hover:bg-muted text-sm mt-2">
          Recommencer
        </button>
      )}
    </div>
  )
}

// ── Main Wizard ────────────────────────────────────────────────────────────

export function MotionWizard() {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7>(1)
  const [launching, setLaunching] = useState(false)
  const [videoId, setVideoId] = useState<string | null>(null)
  const [state, setState] = useState<WizardState>({
    title:     '',
    brief:     '',
    brand:     { primary_color: '#3B8EF0' },
    format:    '16:9',
    duration:  '30s',
    style:     null,
    voiceId:   '',
    voiceName: 'Pas de voix off',
  })

  function updateState<K extends keyof WizardState>(key: K, value: WizardState[K]) {
    setState((prev) => ({ ...prev, [key]: value }))
  }

  async function handleLaunch() {
    if (!state.style || !state.title.trim() || !state.brief.trim()) return
    setLaunching(true)
    try {
      const { video_id } = await startMotionGeneration({
        title:        state.title,
        brief:        state.brief,
        format:       state.format,
        duration:     state.duration,
        style:        state.style,
        brand_config: { ...state.brand, style: state.style },
        voice_id:     state.voiceId || undefined,
      })
      setVideoId(video_id)
      setStep(7)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors du lancement')
    } finally {
      setLaunching(false)
    }
  }

  function reset() {
    setStep(1)
    setVideoId(null)
    setState({ title: '', brief: '', brand: { primary_color: '#3B8EF0' }, format: '16:9', duration: '30s', style: null, voiceId: '', voiceName: 'Pas de voix off' })
  }

  return (
    <div className="max-w-2xl">
      {step < 7 && (
        <div className="flex items-center gap-1.5 mb-8 flex-wrap">
          {STEP_LABELS.map((label, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className={`w-7 h-7 rounded-full border font-mono text-xs flex items-center justify-center transition-all ${
                step > i + 1
                  ? 'bg-clyro-purple border-clyro-purple text-white'
                  : step === i + 1
                  ? 'border-clyro-purple text-clyro-purple bg-clyro-purple/10'
                  : 'border-border text-muted-foreground'
              }`}>
                {step > i + 1 ? '✓' : i + 1}
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div className={`h-px w-4 ${step > i + 1 ? 'bg-clyro-purple' : 'bg-border'}`} />
              )}
            </div>
          ))}
          <span className="font-mono text-xs text-muted-foreground ml-2">
            {STEP_LABELS[(step as number) - 1]}
          </span>
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
            onUpdate={(field, value) => updateState(field as 'format' | 'duration', value as VideoFormat & VideoDuration)}
            onNext={() => setStep(4)}
            onBack={() => setStep(2)}
          />
        )}
        {step === 4 && (
          <StepStyle
            selected={state.style}
            onSelect={(s) => updateState('style', s)}
            onNext={() => setStep(5)}
            onBack={() => setStep(3)}
          />
        )}
        {step === 5 && (
          <StepVoice
            selectedId={state.voiceId}
            onSelect={(id, name) => { updateState('voiceId', id); updateState('voiceName', name) }}
            onNext={() => setStep(6)}
            onBack={() => setStep(4)}
          />
        )}
        {step === 6 && (
          <StepConfirm
            state={state}
            onLaunch={handleLaunch}
            onBack={() => setStep(5)}
            launching={launching}
          />
        )}
        {step === 7 && videoId && <StepGenerating videoId={videoId} onReset={reset} />}
      </div>
    </div>
  )
}
