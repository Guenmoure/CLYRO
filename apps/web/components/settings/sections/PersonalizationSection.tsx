'use client'

import { useEffect, useState } from 'react'
import { Check, Film, Mic2, Clock, Palette } from 'lucide-react'
import { getPublicVoices, type ClyroVoice } from '@/lib/api'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

type Duration = '15s' | '30s' | '60s' | '90s'
type Format = '9:16' | '1:1' | '16:9'

const STYLES = [
  { id: 'cinematique',  label: 'Cinematic',  color: 'bg-amber-500/15 border-amber-500/40 text-amber-500'  },
  { id: 'animation-2d', label: '2D Animation', color: 'bg-pink-500/15 border-pink-500/40 text-pink-500'     },
  { id: 'minimaliste',  label: 'Minimalist',  color: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-500' },
  { id: 'infographie',  label: 'Infographic',  color: 'bg-blue-500/15 border-blue-500/40 text-blue-500'     },
  { id: 'stock-vo',     label: 'Stock VO',     color: 'bg-slate-500/15 border-slate-500/40 text-slate-500'  },
  { id: 'whiteboard',   label: 'Whiteboard',   color: 'bg-gray-500/15 border-gray-500/40 text-gray-500'     },
] as const

const DURATIONS: Duration[] = ['15s', '30s', '60s', '90s']
const FORMATS: Array<{ id: Format; label: string; ratio: string }> = [
  { id: '9:16', label: 'Vertical', ratio: 'aspect-[9/16] w-6' },
  { id: '1:1',  label: 'Square',    ratio: 'aspect-square w-8'   },
  { id: '16:9', label: 'Landscape',  ratio: 'aspect-video w-12'   },
]

export function PersonalizationSection() {
  const [voices, setVoices] = useState<ClyroVoice[]>([])
  const [loadingVoices, setLoadingVoices] = useState(true)

  const [defaultVoice,    setDefaultVoice]    = useState<string>('')
  const [defaultStyle,    setDefaultStyle]    = useState<string>('cinematique')
  const [defaultDuration, setDefaultDuration] = useState<Duration>('30s')
  const [defaultFormat,   setDefaultFormat]   = useState<Format>('9:16')
  const [autoAdvance,     setAutoAdvance]     = useState(false)

  // Load
  useEffect(() => {
    setDefaultVoice(localStorage.getItem('clyro_default_voice') ?? '')
    setDefaultStyle(localStorage.getItem('clyro_default_style') ?? 'cinematique')
    setDefaultDuration((localStorage.getItem('clyro_default_duration') ?? '30s') as Duration)
    setDefaultFormat((localStorage.getItem('clyro_default_format') ?? '9:16') as Format)
    setAutoAdvance(localStorage.getItem('clyro_auto_advance') === 'true')

    getPublicVoices()
      .then(({ voices: v }) => setVoices(v))
      .catch(() => null)
      .finally(() => setLoadingVoices(false))
  }, [])

  function save<T>(key: string, value: T, label: string) {
    localStorage.setItem(key, String(value))
    toast.success(`${label} updated`)
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground">Personalization</h2>
        <p className="font-body text-sm text-[--text-secondary] mt-1">
          Your default preferences to save time on every new creation.
        </p>
      </div>

      {/* Default voice */}
      <Field icon={Mic2} label="Default voice" description="Applied automatically when starting a new project.">
        <select
          value={defaultVoice}
          onChange={(e) => { setDefaultVoice(e.target.value); save('clyro_default_voice', e.target.value, 'Voix') }}
          disabled={loadingVoices}
          className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-body text-foreground focus:outline-none focus:border-blue-500 transition-colors appearance-none cursor-pointer disabled:opacity-60"
        >
          <option value="">— None (choose each time)</option>
          {voices.map((v) => (
            <option key={v.id} value={v.id}>
              {v.languageFlag ?? '🌐'}  {v.name} {v.accent ? `· ${v.accent}` : ''}
            </option>
          ))}
        </select>
      </Field>

      {/* Default style */}
      <Field icon={Palette} label="Default visual style" description="The style that will be pre-selected when you create a Faceless video.">
        <div className="flex flex-wrap gap-2">
          {STYLES.map((s) => {
            const active = defaultStyle === s.id
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => { setDefaultStyle(s.id); save('clyro_default_style', s.id, 'Style') }}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-body transition-all',
                  active ? `${s.color} font-semibold` : 'bg-background border-border text-[--text-secondary] hover:text-foreground',
                )}
                aria-pressed={active}
              >
                {active && <Check size={12} />}
                {s.label}
              </button>
            )
          })}
        </div>
      </Field>

      {/* Default duration */}
      <Field icon={Clock} label="Default duration" description="Target length of your videos.">
        <div className="inline-flex items-center gap-1 rounded-full border border-border bg-background p-1">
          {DURATIONS.map((d) => {
            const active = defaultDuration === d
            return (
              <button
                key={d}
                type="button"
                onClick={() => { setDefaultDuration(d); save('clyro_default_duration', d, 'Durée') }}
                className={cn(
                  'px-4 py-1.5 rounded-full text-xs font-mono transition-all',
                  active ? 'bg-foreground text-background font-semibold' : 'text-[--text-secondary] hover:text-foreground',
                )}
              >
                {d}
              </button>
            )
          })}
        </div>
      </Field>

      {/* Default format */}
      <Field icon={Film} label="Default format" description="Aspect ratio used when creating.">
        <div className="flex items-end gap-3">
          {FORMATS.map((f) => {
            const active = defaultFormat === f.id
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => { setDefaultFormat(f.id); save('clyro_default_format', f.id, 'Format') }}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-2xl border p-3 transition-all',
                  active ? 'border-blue-500 bg-blue-500/5 ring-2 ring-blue-500/20' : 'border-border bg-background hover:border-border',
                )}
                aria-pressed={active}
              >
                <div className={cn('rounded border border-border bg-muted', f.ratio)} />
                <div className="text-center">
                  <p className={cn('font-mono text-[11px]', active ? 'text-foreground font-semibold' : 'text-[--text-secondary]')}>{f.id}</p>
                  <p className="font-body text-[10px] text-[--text-muted]">{f.label}</p>
                </div>
              </button>
            )
          })}
        </div>
      </Field>

      {/* Auto-advance */}
      <Field label="Auto-advance" description="Move to the next step as soon as a step finishes generating.">
        <button
          type="button"
          onClick={() => { const next = !autoAdvance; setAutoAdvance(next); save('clyro_auto_advance', next, 'Avancement automatique') }}
          className={cn(
            'relative inline-flex items-center w-11 h-6 rounded-full transition-colors',
            autoAdvance ? 'bg-blue-500' : 'bg-muted border border-border',
          )}
          aria-pressed={autoAdvance}
          role="switch"
        >
          <span className={cn(
            'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
            autoAdvance ? 'translate-x-5' : 'translate-x-0.5',
          )} />
        </button>
      </Field>
    </div>
  )
}

// ── Field ────────────────────────────────────────────────────────────────

function Field({
  icon: Icon, label, description, children,
}: {
  icon?: React.ElementType
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="w-9 h-9 rounded-xl bg-muted border border-border flex items-center justify-center shrink-0">
            <Icon size={16} className="text-[--text-secondary]" />
          </div>
        )}
        <div className="space-y-0.5">
          <p className="font-body text-sm font-semibold text-foreground">{label}</p>
          {description && <p className="font-body text-xs text-[--text-secondary]">{description}</p>}
        </div>
      </div>
      <div className={Icon ? 'pl-12' : ''}>
        {children}
      </div>
    </section>
  )
}
