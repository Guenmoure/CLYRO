'use client'

import { CheckCircle, Zap, Clock, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { AnimationMode } from '@clyro/shared'
import { ANIMATION_MODES } from '@clyro/shared'
import { useLanguage } from '@/lib/i18n'

// ── Types ───────────────────────────────────────────────────────────────────────

interface AnimationModeSelectorProps {
  value:    AnimationMode
  onChange: (mode: AnimationMode) => void
  userPlan: 'free' | 'starter' | 'pro' | 'creator' | 'studio'
  /** true = 3 compact cards (for per-scene override popover) */
  compact?:            boolean
  /** Estimated script duration in minutes — used to compute credit cost */
  scriptDurationMin?:  number
}

// ── i18n key maps for mode label / description (shared config is French-only) ─

const MODE_LABEL_KEYS: Record<AnimationMode, string> = {
  storyboard: 'ams_labelStoryboard',
  fast:       'ams_labelFast',
  pro:        'ams_labelPro',
}

const MODE_DESC_KEYS: Record<AnimationMode, string> = {
  storyboard: 'ams_descStoryboard',
  fast:       'ams_descFast',
  pro:        'ams_descPro',
}

// ── Mode indicator (GIF preview) ───────────────────────────────────────────────

const MODE_PREVIEWS: Record<AnimationMode, string> = {
  storyboard: '/previews/mode-storyboard.gif',
  fast:       '/previews/mode-fast.gif',
  pro:        '/previews/mode-pro.gif',
}

function ModeIndicator({ mode, locked }: { mode: AnimationMode; locked: boolean }) {
  return (
    <div className="w-16 h-10 rounded-lg overflow-hidden flex-shrink-0 relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={MODE_PREVIEWS[mode]}
        alt={`Preview ${mode}`}
        className={cn(
          'w-full h-full object-cover',
          locked && 'grayscale opacity-50',
        )}
      />
      {locked && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Lock size={10} className="text-white/70" />
        </div>
      )}
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────────

export default function AnimationModeSelector({
  value,
  onChange,
  userPlan,
  compact = false,
  scriptDurationMin,
}: AnimationModeSelectorProps) {
  const { t } = useLanguage()
  const MODES: AnimationMode[] = ['storyboard', 'fast', 'pro']

  return (
    <div className={cn('grid gap-3', compact ? 'grid-cols-3' : 'grid-cols-1 md:grid-cols-3')}>
      {MODES.map((mode) => {
        const config  = ANIMATION_MODES[mode]
        const locked  = !config.availablePlans.includes(userPlan)
        const active  = value === mode
        const credits = scriptDurationMin != null
          ? Math.ceil(scriptDurationMin * config.creditsPerMin)
          : null

        return (
          <button
            key={mode}
            type="button"
            disabled={locked}
            onClick={() => !locked && onChange(mode)}
            className={cn(
              'relative rounded-2xl border text-left transition-all duration-200',
              compact ? 'p-3' : 'p-5',
              active && !locked
                ? 'border-primary bg-brand/10 shadow-glow-brand'
                : 'border-border bg-muted hover:border-brand/30',
              locked && 'opacity-50 cursor-not-allowed',
            )}
          >
            {/* "Recommandé" badge on Fast */}
            {mode === 'fast' && !compact && (
              <Badge variant="success" className="absolute -top-2.5 left-4">
                {t('ams_recommended')}
              </Badge>
            )}

            {/* Header row */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <ModeIndicator mode={mode} locked={locked} />
                <span className="font-display text-sm text-foreground">{t(MODE_LABEL_KEYS[mode])}</span>
              </div>

              {locked ? (
                <span className="flex items-center gap-1">
                  <Lock size={10} className="text-violet-500" />
                  <Badge variant="purple" className="text-[10px]">Pro+</Badge>
                </span>
              ) : active ? (
                <CheckCircle size={16} className="text-primary flex-shrink-0 mt-0.5" />
              ) : null}
            </div>

            {/* Description — hidden in compact mode */}
            {!compact && (
              <p className="font-body text-xs text-[--text-muted] mt-2 leading-relaxed">
                {t(MODE_DESC_KEYS[mode])}
              </p>
            )}

            {/* Stats row */}
            <div className={cn('flex gap-3 mt-3', compact ? 'flex-col gap-1' : 'flex-row')}>
              <div className="flex items-center gap-1">
                <Zap size={10} className="text-amber-400" />
                <span className="font-mono text-[11px] text-amber-400">
                  {config.creditsPerMin} cr/min
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Clock size={10} className="text-[--text-muted]" />
                <span className="font-mono text-[11px] text-[--text-muted]">
                  {config.generationTime}
                </span>
              </div>
            </div>

            {/* Estimated cost — only in full mode when duration is known */}
            {credits !== null && !compact && (
              <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
                <span className="font-mono text-[11px] text-[--text-muted]">
                  {t('ams_estimated').replace('{n}', String(scriptDurationMin))}
                </span>
                <span className={cn(
                  'font-mono text-xs font-medium',
                  active ? 'text-primary' : 'text-[--text-secondary]',
                )}>
                  ~{credits} {t('ams_credits')}
                </span>
              </div>
            )}

            {/* Locked CTA */}
            {locked && !compact && (
              <div className="mt-3 pt-3 border-t border-border/50">
                <p className="font-mono text-[11px] text-violet-500">
                  {t('ams_lockedHint')}
                </p>
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
