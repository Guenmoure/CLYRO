'use client'

import { useState, useCallback, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useDraftSave } from '@/hooks/use-draft-save'
import { createBrowserClient } from '@/lib/supabase'
import { Mic, MicOff, Volume2, AlertTriangle, ShoppingCart, Captions, Music, Link2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WizardLayout } from '@/components/creation/WizardLayout'
import { GenerationOverlay, type GenerationStage } from '@/components/creation/GenerationOverlay'
import { StyleCarousel, type StyleConfig } from '@/components/creation/StyleCarousel'
import { VoicePickerModal, type ClyroVoice } from '@/components/creation/VoicePickerModal'
import { CloneVoiceModal, type UserPlan } from '@/components/assets/CloneVoiceModal'
import { ResultModal } from '@/components/creation/ResultModal'
import AnimationModeSelector from '@/components/creation/AnimationModeSelector'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/toast'
import {
  startFacelessGeneration,
  getPublicVoices,
  subscribeToVideoStatus,
  generateScriptFromUrl,
} from '@/lib/api'
import { useLanguage } from '@/lib/i18n'
import type { FacelessStyle, VideoFormat, VideoDuration, AnimationMode } from '@clyro/shared'
import { ANIMATION_MODES } from '@clyro/shared'

// F1-012: music preset type mirrors the one in packages/shared/src/types/video.ts
type MusicPreset = 'none' | 'soft' | 'upbeat' | 'cinematic' | 'corporate'

// ── Constants (id-only — labels resolved via t() inside components) ────────────

const STEP_IDS = ['script', 'styleVoice', 'animation', 'format', 'options', 'review'] as const

const FACELESS_STYLE_IDS: { id: FacelessStyle; pro: boolean }[] = [
  { id: 'cinematique',     pro: false },
  { id: 'stock-vo',        pro: false },
  { id: 'whiteboard',      pro: false },
  { id: 'stickman',        pro: false },
  { id: 'flat-design',     pro: true  },
  { id: '3d-pixar',        pro: true  },
  { id: 'minimaliste',     pro: false },
  { id: 'infographie',     pro: true  },
  { id: 'motion-graphics', pro: true  },
  { id: 'animation-2d',    pro: true  },
]

// Maps style id → translation key prefix (hyphens stripped for key compatibility)
const styleKeyMap: Record<string, string> = {
  'cinematique':     'fn_style_cinematique',
  'stock-vo':        'fn_style_stockvo',
  'whiteboard':      'fn_style_whiteboard',
  'stickman':        'fn_style_stickman',
  'flat-design':     'fn_style_flatdesign',
  '3d-pixar':        'fn_style_3dpixar',
  'minimaliste':     'fn_style_minimaliste',
  'infographie':     'fn_style_infographie',
  'motion-graphics': 'fn_style_motiongraphics',
  'animation-2d':    'fn_style_animation2d',
}

const FORMAT_VALUES: { value: VideoFormat; tk_label: string; tk_desc: string }[] = [
  { value: '9:16', tk_label: 'fn_format_vertical_label',  tk_desc: 'fn_format_vertical_desc'  },
  { value: '1:1',  tk_label: 'fn_format_square_label',    tk_desc: 'fn_format_square_desc'    },
  { value: '16:9', tk_label: 'fn_format_landscape_label', tk_desc: 'fn_format_landscape_desc' },
]

const DURATION_VALUES: { value: VideoDuration; tk: string }[] = [
  { value: 'auto', tk: 'fn_duration_auto'  },
  { value: '15s',  tk: 'fn_duration_15s'   },
  { value: '30s',  tk: 'fn_duration_30s'   },
  { value: '60s',  tk: 'fn_duration_60s'   },
  { value: '120s', tk: 'fn_duration_120s'  },
  { value: '180s', tk: 'fn_duration_180s'  },
  { value: '300s', tk: 'fn_duration_300s'  },
]

const MUSIC_PRESET_IDS: { id: MusicPreset; tk_label: string; tk_desc: string }[] = [
  { id: 'none',      tk_label: 'fn_music_none_label',      tk_desc: 'fn_music_none_desc'      },
  { id: 'soft',      tk_label: 'fn_music_soft_label',      tk_desc: 'fn_music_soft_desc'      },
  { id: 'upbeat',    tk_label: 'fn_music_upbeat_label',    tk_desc: 'fn_music_upbeat_desc'    },
  { id: 'cinematic', tk_label: 'fn_music_cinematic_label', tk_desc: 'fn_music_cinematic_desc' },
  { id: 'corporate', tk_label: 'fn_music_corporate_label', tk_desc: 'fn_music_corporate_desc' },
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-xl text-foreground mb-1">{children}</h2>
}
function SectionSub({ children }: { children: React.ReactNode }) {
  return <p className="font-body text-sm text-[--text-muted] mb-6">{children}</p>
}

// ── Step 0 — Script ────────────────────────────────────────────────────────────

type ScriptSource = 'text' | 'url'
type UrlImportLength = 'short' | 'medium' | 'long'

function StepScript({
  script,
  onChange,
  initialSource = 'text',
}: {
  script: string
  onChange: (v: string) => void
  initialSource?: ScriptSource
}) {
  const { t } = useLanguage()
  const wordCount = script.trim().split(/\s+/).filter(Boolean).length
  const [source, setSource] = useState<ScriptSource>(initialSource)
  const [url, setUrl] = useState('')
  const [urlLength, setUrlLength] = useState<UrlImportLength>('medium')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  const handleImport = useCallback(async () => {
    const clean = url.trim()
    if (!clean) return
    setImportError(null)
    setImporting(true)
    try {
      const data = await generateScriptFromUrl({ url: clean, length: urlLength })
      const next = data.script.trim()
      if (!next) throw new Error(t('fn_toast_scriptEmpty'))
      onChange(next)
      toast.success(
        t('fn_toast_scriptImported')
          .replace('{title}', data.source.title || data.source.finalUrl)
          .replace('{n}', String(data.wordCount)),
      )
      setSource('text')  // show the imported text so users can edit before continuing
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('fn_toast_unknownError')
      setImportError(msg)
      toast.error(msg)
    } finally {
      setImporting(false)
    }
  }, [url, urlLength, onChange, t])

  return (
    <div className="space-y-4">
      <SectionTitle>{t('fn_script_title')}</SectionTitle>
      <SectionSub>{t('fn_script_sub')}</SectionSub>

      {/* Source tabs — text OR import from URL (use aria-pressed since these
          are toggle-style buttons, not a full tablist pattern) */}
      <div className="inline-flex rounded-lg bg-muted border border-border p-1" role="group" aria-label="Script source">
        <button
          type="button"
          aria-pressed={source === 'text'}
          onClick={() => setSource('text')}
          className={cn(
            'px-3 py-1.5 text-xs font-display rounded-md transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60',
            source === 'text' ? 'bg-background text-foreground shadow-sm' : 'text-[--text-muted] hover:text-foreground',
          )}
        >
          {t('fn_source_text')}
        </button>
        <button
          type="button"
          aria-pressed={source === 'url'}
          onClick={() => setSource('url')}
          className={cn(
            'px-3 py-1.5 text-xs font-display rounded-md transition-colors flex items-center gap-1.5',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60',
            source === 'url' ? 'bg-background text-foreground shadow-sm' : 'text-[--text-muted] hover:text-foreground',
          )}
        >
          <Link2 size={13} aria-hidden="true" />
          {t('fn_source_url')}
        </button>
      </div>

      {source === 'url' ? (
        <div className="space-y-3 rounded-xl border border-border bg-muted/40 p-4">
          <p className="font-body text-sm text-[--text-muted]">
            {t('fn_url_desc')}
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="url-import-input"
              type="url"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t('fn_url_placeholder')}
              aria-label={t('fn_url_ariaLabel')}
              aria-invalid={importError ? true : undefined}
              aria-describedby={importError ? 'url-import-error' : undefined}
              className="flex-1 bg-background border border-border rounded-lg px-3 py-2 font-body text-sm text-foreground placeholder-[--text-muted] focus:outline-none focus:border-blue-500/60 focus-visible:ring-2 focus-visible:ring-blue-500/40"
              onKeyDown={(e) => { if (e.key === 'Enter' && !importing) handleImport() }}
              disabled={importing}
            />
            <select
              value={urlLength}
              onChange={(e) => setUrlLength(e.target.value as UrlImportLength)}
              aria-label={t('fn_url_targetLength')}
              className="bg-background border border-border rounded-lg px-3 py-2 font-body text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
              disabled={importing}
            >
              <option value="short">{t('fn_url_short')}</option>
              <option value="medium">{t('fn_url_medium')}</option>
              <option value="long">{t('fn_url_long')}</option>
            </select>
            <Button
              type="button"
              onClick={handleImport}
              disabled={!url.trim() || importing}
              className="min-w-[110px]"
            >
              {importing ? (
                <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" aria-hidden="true" />{t('fn_url_importing')}</span>
              ) : (
                t('fn_url_import')
              )}
            </Button>
          </div>
          {importError && (
            <p
              id="url-import-error"
              role="alert"
              className="font-mono text-xs text-red-400"
            >
              {importError}
            </p>
          )}
          <p className="font-mono text-xs text-[--text-muted]">
            {t('fn_url_tip')}
          </p>
        </div>
      ) : (
        <>
          <textarea
            value={script}
            onChange={e => onChange(e.target.value)}
            rows={14}
            placeholder={t('fn_script_placeholder')}
            className="w-full bg-muted border border-border rounded-xl px-4 py-3 font-body text-sm text-foreground placeholder-[--text-muted] resize-none focus:outline-none focus:border-blue-500/60 transition-colors"
          />
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs text-[--text-muted]">
              {t('fn_words_narration')
                .replace('{n}', String(wordCount))
                .replace('{m}', String(Math.round(wordCount / 130)))}
            </p>
            {wordCount > 600 && (
              <Badge variant="warning">{t('fn_long_script_badge')}</Badge>
            )}
          </div>
        </>
      )}
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
  const { t } = useLanguage()

  const facelessStyles: StyleConfig[] = FACELESS_STYLE_IDS.map(({ id, pro }) => ({
    id,
    pro,
    name:        t(`${styleKeyMap[id]}_name` as any),
    description: t(`${styleKeyMap[id]}_desc` as any),
  }))

  return (
    <div className="space-y-8">
      <div>
        <SectionTitle>{t('fn_visual_style_title')}</SectionTitle>
        <SectionSub>{t('fn_visual_style_sub')}</SectionSub>
        <StyleCarousel
          styles={facelessStyles}
          selected={selectedStyle}
          onChange={(id) => onStyleChange(id as FacelessStyle)}
          userPlan={userPlan}
        />
      </div>

      <div>
        <SectionTitle>{t('fn_voice_title')}</SectionTitle>
        <SectionSub>{t('fn_voice_sub')}</SectionSub>
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
              <p className="font-body text-sm text-[--text-muted]">{t('fn_no_voice_selected')}</p>
            )}
          </div>
          <Badge variant="neutral">{t('fn_voice_change')}</Badge>
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
  const { t } = useLanguage()
  const durationMin      = Math.max(1, Math.ceil(wordCount / 150))
  const config           = ANIMATION_MODES[animationMode]
  const estimatedCredits = Math.ceil(durationMin * config.creditsPerMin)
  const scenesEstimate   = Math.max(3, Math.round(wordCount / 60))
  const insufficient     = creditsBalance < estimatedCredits

  return (
    <div className="space-y-6">
      <div className="text-center">
        <SectionTitle>{t('fn_animation_title')}</SectionTitle>
        <SectionSub>{t('fn_animation_sub')}</SectionSub>
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
            <p className="font-display text-sm text-foreground">{t('fn_estimate_title')}</p>
            <p className="font-body text-xs text-[--text-muted] mt-0.5">
              {t('fn_estimate_sub')
                .replace('{d}', String(durationMin))
                .replace('{s}', String(scenesEstimate))
                .replace('{m}', config.label)}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-display text-xl bg-grad-primary bg-clip-text text-transparent">
              {t('fn_estimate_credits').replace('{c}', String(estimatedCredits))}
            </p>
            <p className="font-mono text-xs text-[--text-muted] mt-0.5">
              {t('fn_estimate_balance').replace('{b}', String(creditsBalance))}
            </p>
          </div>
        </div>

        {insufficient && (
          <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-3">
            <AlertTriangle size={14} className="text-warning shrink-0" />
            <p className="font-body text-xs text-[--text-muted] flex-1">
              {t('fn_insufficient_msg')}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 gap-1.5"
              onClick={() => window.open('/settings/billing', '_blank')}
            >
              <ShoppingCart size={12} />
              {t('fn_buy_credits')}
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
  const { t } = useLanguage()

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
        <SectionTitle>{t('fn_format_title')}</SectionTitle>
        <SectionSub>{t('fn_format_sub')}</SectionSub>
        <div className="flex gap-4 flex-wrap">
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
      </div>

      <div>
        <SectionTitle>{t('fn_duration_title')}</SectionTitle>
        <SectionSub>{t('fn_duration_sub')}</SectionSub>
        <div className="flex gap-3 flex-wrap">
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

// ── Step 4 — Options ───────────────────────────────────────────────────────────

function StepOptions({
  dialogueMode,
  onDialogueModeChange,
  musicPreset,
  onMusicPresetChange,
  subtitlesEnabled,
  onSubtitlesChange,
}: {
  dialogueMode: boolean
  onDialogueModeChange: (v: boolean) => void
  musicPreset: MusicPreset
  onMusicPresetChange: (m: MusicPreset) => void
  subtitlesEnabled: boolean
  onSubtitlesChange: (v: boolean) => void
}) {
  const { t } = useLanguage()

  const musicPresets = MUSIC_PRESET_IDS.map(p => ({
    ...p,
    label: t(p.tk_label as any),
    desc:  t(p.tk_desc  as any),
  }))

  return (
    <div className="space-y-6">
      <SectionTitle>{t('fn_options_title')}</SectionTitle>
      <SectionSub>{t('fn_options_sub')}</SectionSub>

      {/* Dialogue mode toggle */}
      <div className="flex items-center justify-between rounded-xl bg-muted border border-border px-4 py-4">
        <div className="flex items-center gap-3">
          {dialogueMode ? (
            <Mic size={18} className="text-blue-400" />
          ) : (
            <MicOff size={18} className="text-[--text-muted]" />
          )}
          <div>
            <p className="font-display text-sm text-foreground">{t('fn_dialogue_title')}</p>
            <p className="font-body text-xs text-[--text-muted]">
              {t('fn_dialogue_desc')}
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
          title={dialogueMode ? t('fn_dialogue_disable') : t('fn_dialogue_enable')}
          aria-checked={dialogueMode}
        >
          <span className={cn(
            'absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200',
            dialogueMode ? 'translate-x-6' : 'translate-x-1',
          )} />
        </button>
      </div>

      {/* F1-013: subtitle burn-in toggle */}
      <div className="flex items-center justify-between rounded-xl bg-muted border border-border px-4 py-4">
        <div className="flex items-center gap-3">
          <Captions
            size={18}
            className={subtitlesEnabled ? 'text-blue-400' : 'text-[--text-muted]'}
          />
          <div>
            <p className="font-display text-sm text-foreground">{t('fn_subtitles_title')}</p>
            <p className="font-body text-xs text-[--text-muted]">
              {t('fn_subtitles_desc')}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onSubtitlesChange(!subtitlesEnabled)}
          className={cn(
            'relative w-11 h-6 rounded-full transition-colors duration-200',
            subtitlesEnabled ? 'bg-blue-500' : 'bg-border',
          )}
          role="switch"
          title={subtitlesEnabled ? t('fn_subtitles_disable') : t('fn_subtitles_enable')}
          aria-checked={subtitlesEnabled}
        >
          <span className={cn(
            'absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200',
            subtitlesEnabled ? 'translate-x-6' : 'translate-x-1',
          )} />
        </button>
      </div>

      {/* F1-012: background music picker */}
      <div className="rounded-xl bg-muted border border-border px-4 py-4">
        <div className="flex items-center gap-3 mb-3">
          <Music size={18} className="text-blue-400" />
          <div>
            <p className="font-display text-sm text-foreground">{t('fn_music_title')}</p>
            <p className="font-body text-xs text-[--text-muted]">
              {t('fn_music_desc')}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2" role="radiogroup" aria-label={t('fn_music_ariaLabel')}>
          {musicPresets.map(p => {
            const active = musicPreset === p.id
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onMusicPresetChange(p.id)}
                className={cn(
                  'flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition-all',
                  active
                    ? 'border-blue-500 bg-blue-500/10 text-foreground'
                    : 'border-border text-[--text-muted] hover:border-border/70 hover:text-foreground',
                )}
              >
                <span className="font-display text-xs font-semibold">{p.label}</span>
                <span className="font-body text-[10px]">{p.desc}</span>
              </button>
            )
          })}
        </div>
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
  musicPreset,
  subtitlesEnabled,
}: {
  title: string
  script: string
  style: FacelessStyle
  voice?: ClyroVoice
  animationMode: AnimationMode
  format: VideoFormat
  duration: VideoDuration
  dialogueMode: boolean
  musicPreset: MusicPreset
  subtitlesEnabled: boolean
}) {
  const { t } = useLanguage()
  const wordCount  = script.trim().split(/\s+/).filter(Boolean).length
  const styleName  = t(`${styleKeyMap[style]}_name` as any)
  const animConfig = ANIMATION_MODES[animationMode]
  const musicLabel = t(`fn_music_${musicPreset}_label` as any)

  const rows: [string, string][] = [
    [t('fn_review_row_title'),    title || '—'],
    [t('fn_review_row_script'),   t('fn_review_row_words').replace('{n}', String(wordCount))],
    [t('fn_review_row_style'),    styleName],
    [t('fn_review_row_voice'),    voice?.name ?? t('fn_review_row_voice_none')],
    [t('fn_review_row_animation'), `${animConfig.label} · ${animConfig.generationTime}`],
    [t('fn_review_row_format'),   format],
    [t('fn_review_row_duration'), duration],
    [t('fn_review_row_dialogue'), dialogueMode ? t('fn_review_row_dialogue_on') : t('fn_review_row_dialogue_off')],
    [t('fn_review_row_music'),    musicLabel],
    [t('fn_review_row_subtitles'), subtitlesEnabled ? t('fn_review_row_subtitles_on') : t('fn_review_row_subtitles_off')],
  ]

  return (
    <div className="space-y-4">
      <SectionTitle>{t('fn_review_title')}</SectionTitle>
      <SectionSub>{t('fn_review_sub')}</SectionSub>

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
            {t('fn_review_anim_info')
              .replace('{label}', animConfig.label)
              .replace('{time}', animConfig.generationTime)}
          </p>
        </div>
      )}

      <p className="font-body text-xs text-[--text-muted] text-center mt-4">
        {t('fn_review_timing')}
      </p>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

function FacelessNewPageInner() {
  const router      = useRouter()
  const params      = useSearchParams()
  const draftParam  = params.get('draft')
  const { t }       = useLanguage()

  const STEPS = STEP_IDS.map((id) => ({
    id,
    label: t(`fn_step_${id}` as any),
  }))

  const GENERATION_STAGES: GenerationStage[] = [
    { main: t('fn_genStage0_main'), sub: t('fn_genStage0_sub') },
    { main: t('fn_genStage1_main'), sub: t('fn_genStage1_sub') },
    { main: t('fn_genStage2_main'), sub: t('fn_genStage2_sub') },
    { main: t('fn_genStage3_main'), sub: t('fn_genStage3_sub') },
    { main: t('fn_genStage4_main'), sub: t('fn_genStage4_sub') },
  ]

  const CONTEXTUAL_HELP = STEP_IDS.map((_, i) => t(`fn_help_${i}` as any))

  const [currentStep,    setCurrentStep]    = useState(0)
  const [projectName,    setProjectName]    = useState(() => t('fn_defaultProjectName'))
  const [script,         setScript]         = useState('')
  const [style,          setStyle]          = useState<FacelessStyle>('cinematique')
  const [selectedVoice,  setSelectedVoice]  = useState<ClyroVoice | undefined>()
  const [animationMode,  setAnimationMode]  = useState<AnimationMode>('storyboard')
  const [format,         setFormat]         = useState<VideoFormat>('9:16')
  const [duration,       setDuration]       = useState<VideoDuration>('auto')
  const [dialogueMode,   setDialogueMode]   = useState(false)
  const [musicPreset,    setMusicPreset]    = useState<MusicPreset>('none')
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false)

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
      .then(({ data, error }: { data: any; error: any }) => {
        if (error) {
          console.error('[faceless/new] Failed to restore draft:', error.message)
          return
        }
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
        if (typeof s.musicPreset === 'string')    setMusicPreset(s.musicPreset as MusicPreset)
        if (typeof s.subtitlesEnabled === 'boolean') setSubtitlesEnabled(s.subtitlesEnabled)
        if (typeof data.wizard_step === 'number' && data.wizard_step >= 4) {
          toast.success(t('fn_toast_projectRestored'))
        }
      }, (err: unknown) => {
        console.error('[faceless/new] Unexpected error restoring draft:', err)
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
    state:       { script, style, selectedVoice, animationMode, format, duration, dialogueMode, musicPreset, subtitlesEnabled },
    initialDraftId: draftParam,
  })

  // User profile
  const [userPlan,        setUserPlan]        = useState<'free' | 'starter' | 'pro' | 'creator' | 'studio'>('free')
  const [creditsBalance,  setCreditsBalance]  = useState(0)

  // Voice picker
  const [voicePickerOpen, setVoicePickerOpen] = useState(false)
  const [libraryVoices,   setLibraryVoices]   = useState<ClyroVoice[]>([])
  const [clonedVoices,    setClonedVoices]    = useState<ClyroVoice[]>([])
  const [voicesLoading,   setVoicesLoading]   = useState(false)
  const [cloneVoiceOpen,  setCloneVoiceOpen]  = useState(false)

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
        .select('plan, credits')
        .eq('id', session.user.id)
        .single()
        .then(({ data, error }: { data: any; error: any }) => {
          if (error) {
            console.error('[faceless/new] Failed to load profile:', error.message)
            return
          }
          if (data) {
            setUserPlan((data.plan as typeof userPlan) ?? 'free')
            setCreditsBalance(data.credits ?? 0)
          }
        }, (err: unknown) => {
          console.error('[faceless/new] Unexpected error loading profile:', err)
        })
    }, (err: unknown) => {
      console.error('[faceless/new] Unexpected error getting session:', err)
    })
  }, [])

  // Reload the user's cloned voices (called after the clone modal succeeds
  // and when the picker first opens). Uses getVoices(), which merges public
  // + personal voices on the server.
  const reloadClonedVoices = useCallback(async () => {
    try {
      const { getVoices } = await import('@/lib/api')
      const res = await getVoices()
      const personal = (res.personal ?? []) as ClyroVoice[]
      setClonedVoices(personal)
    } catch {
      // silent — cloned tab just stays empty
    }
  }, [])

  // Load voices when voice picker opens
  async function handleOpenVoicePicker() {
    setVoicePickerOpen(true)
    // Always refresh cloned voices on open — they might have changed in
    // another tab (or via the clone modal inside this picker).
    reloadClonedVoices()
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
    // CRED-007: explicitly surface the "insufficient credits" state as a toast
    // so the user understands why Next is blocked (previously the button was
    // silently disabled by canNext()).
    if (creditInsufficient) {
      toast.error(
        t('fn_toast_insufficientCredits')
          .replace('{b}', String(creditsBalance))
          .replace('{r}', String(estimatedCredits)),
      )
      return
    }
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
        music_preset: musicPreset,
        subtitles_enabled: subtitlesEnabled,
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
            reject(new Error('Generation failed'))
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('fn_toast_unknownError')
      console.error('[faceless/new] generation failed:', err)
      toast.error(t('fn_toast_generationFailed').replace('{msg}', msg))
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
        featureTitle={t('fn_featureTitle')}
        featureHref="/faceless"
        currentPageLabel={t('fn_newVideo')}
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
        nextLabel={isLastStep ? t('fn_launchLabel') : t('fn_nextLabel')}
      >
        <div className="max-w-2xl mx-auto px-6 py-8">
          {currentStep === 0 && (
            <StepScript
              script={script}
              onChange={setScript}
              initialSource={params.get('source') === 'url' ? 'url' : 'text'}
            />
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
              musicPreset={musicPreset}
              onMusicPresetChange={setMusicPreset}
              subtitlesEnabled={subtitlesEnabled}
              onSubtitlesChange={setSubtitlesEnabled}
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
              musicPreset={musicPreset}
              subtitlesEnabled={subtitlesEnabled}
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
        clonedVoices={clonedVoices}
        loading={voicesLoading}
        onRequestClone={() => setCloneVoiceOpen(true)}
      />

      <CloneVoiceModal
        isOpen={cloneVoiceOpen}
        onClose={() => setCloneVoiceOpen(false)}
        userPlan={userPlan as UserPlan}
        onCloned={async () => {
          await reloadClonedVoices()
          setCloneVoiceOpen(false)
        }}
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

export default function FacelessNewPage() {
  return (
    <Suspense>
      <FacelessNewPageInner />
    </Suspense>
  )
}
