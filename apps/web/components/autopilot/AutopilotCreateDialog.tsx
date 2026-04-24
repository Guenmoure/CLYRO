'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Rocket, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import type { CreateAutopilotPayload, AutopilotCadence } from '@/lib/api'

interface Props {
  isOpen: boolean
  onClose: () => void
  onCreate: (payload: CreateAutopilotPayload) => Promise<void>
}

const CADENCE_OPTIONS: Array<{ value: AutopilotCadence; label: string; desc: string }> = [
  { value: 'daily',  label: 'Daily',  desc: 'A new video every ~24h' },
  { value: 'weekly', label: 'Weekly', desc: 'A new video every ~7d' },
  { value: 'manual', label: 'Manual', desc: 'Never auto-run — only "Run now"' },
]

const STYLE_OPTIONS = [
  { value: 'cinematic',    label: 'Cinematic' },
  { value: 'documentary',  label: 'Documentary' },
  { value: 'educational',  label: 'Educational' },
  { value: 'motivational', label: 'Motivational' },
  { value: 'minimalist',   label: 'Minimalist' },
]

export function AutopilotCreateDialog({ isOpen, onClose, onCreate }: Props) {
  const [name, setName] = useState('')
  const [topic, setTopic] = useState('')
  const [cadence, setCadence] = useState<AutopilotCadence>('weekly')
  const [style, setStyle] = useState('cinematic')
  const [language, setLanguage] = useState('fr')
  const [duration, setDuration] = useState(60)
  const [format, setFormat] = useState<'9:16' | '16:9' | '1:1'>('9:16')
  const [submitting, setSubmitting] = useState(false)

  const dialogRef = useRef<HTMLDivElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setName('')
      setTopic('')
      setCadence('weekly')
      setStyle('cinematic')
      setLanguage('fr')
      setDuration(60)
      setFormat('9:16')
      setSubmitting(false)
    }
  }, [isOpen])

  // Auto-focus + Escape + Tab trap
  useEffect(() => {
    if (!isOpen) return
    const id = window.setTimeout(() => nameRef.current?.focus(), 0)

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting) { onClose(); return }
      if (e.key !== 'Tab' || !dialogRef.current) return
      const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey) {
        if (active === first || !dialogRef.current.contains(active)) {
          e.preventDefault()
          last.focus()
        }
      } else if (active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(id)
      window.removeEventListener('keydown', onKey)
    }
  }, [isOpen, submitting, onClose])

  if (!isOpen) return null

  async function handleSubmit() {
    if (!name.trim() || !topic.trim() || submitting) return
    setSubmitting(true)
    try {
      await onCreate({
        name: name.trim(),
        topic: topic.trim(),
        cadence,
        style,
        language,
        duration,
        format,
        enabled: true,
      })
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Creation failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="autopilot-create-title"
      onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose() }}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-xl overflow-hidden max-h-[90vh] overflow-y-auto"
      >
        <header className="flex items-start gap-3 px-6 pt-6 pb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0" aria-hidden="true">
            <Rocket size={18} className="text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 id="autopilot-create-title" className="font-display text-base font-semibold text-foreground">
              New Autopilot series
            </h2>
            <p className="font-body text-sm text-[--text-muted] mt-0.5">
              Pick a topic and cadence — we'll auto-generate new videos on schedule.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close dialog"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[--text-muted] hover:text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 disabled:opacity-50 shrink-0"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <div className="px-6 pb-4 space-y-4">
          {/* Name */}
          <div>
            <label htmlFor="ap-name" className="block font-display text-xs font-medium text-foreground mb-1.5">
              Series name
            </label>
            <input
              id="ap-name"
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Daily startup stories"
              maxLength={120}
              disabled={submitting}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 font-body text-sm text-foreground placeholder-[--text-muted] focus:outline-none focus:border-blue-500/60 focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-50"
            />
          </div>

          {/* Topic */}
          <div>
            <label htmlFor="ap-topic" className="block font-display text-xs font-medium text-foreground mb-1.5">
              Topic
            </label>
            <textarea
              id="ap-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Ex: Founders who failed before hitting $1M ARR — lessons, patterns, surprises."
              maxLength={500}
              rows={3}
              disabled={submitting}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 font-body text-sm text-foreground placeholder-[--text-muted] focus:outline-none focus:border-blue-500/60 focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-50 resize-none"
            />
            <p className="font-mono text-[10px] text-[--text-muted] mt-1">
              {topic.length} / 500 · We'll pick a fresh angle each run.
            </p>
          </div>

          {/* Cadence */}
          <fieldset>
            <legend className="font-display text-xs font-medium text-foreground mb-2">
              Cadence
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="radiogroup" aria-label="Cadence">
              {CADENCE_OPTIONS.map(opt => {
                const active = cadence === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setCadence(opt.value)}
                    disabled={submitting}
                    className={`text-left rounded-xl border p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-50 ${
                      active
                        ? 'border-blue-500/60 bg-blue-500/5'
                        : 'border-border bg-muted/30 hover:border-border hover:bg-muted/60'
                    }`}
                  >
                    <p className="font-display text-xs font-semibold text-foreground">{opt.label}</p>
                    <p className="font-body text-[11px] text-[--text-muted] mt-1">{opt.desc}</p>
                  </button>
                )
              })}
            </div>
          </fieldset>

          {/* Style + language + format + duration */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="ap-style" className="block font-display text-xs font-medium text-foreground mb-1.5">
                Style
              </label>
              <select
                id="ap-style"
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                disabled={submitting}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 font-body text-sm text-foreground focus:outline-none focus:border-blue-500/60 focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-50"
              >
                {STYLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="ap-lang" className="block font-display text-xs font-medium text-foreground mb-1.5">
                Language
              </label>
              <select
                id="ap-lang"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                disabled={submitting}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 font-body text-sm text-foreground focus:outline-none focus:border-blue-500/60 focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-50"
              >
                <option value="fr">Français</option>
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="de">Deutsch</option>
                <option value="it">Italiano</option>
                <option value="pt">Português</option>
              </select>
            </div>
            <div>
              <label htmlFor="ap-format" className="block font-display text-xs font-medium text-foreground mb-1.5">
                Format
              </label>
              <select
                id="ap-format"
                value={format}
                onChange={(e) => setFormat(e.target.value as '9:16' | '16:9' | '1:1')}
                disabled={submitting}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 font-body text-sm text-foreground focus:outline-none focus:border-blue-500/60 focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-50"
              >
                <option value="9:16">9:16 (Vertical)</option>
                <option value="16:9">16:9 (Landscape)</option>
                <option value="1:1">1:1 (Square)</option>
              </select>
            </div>
            <div>
              <label htmlFor="ap-duration" className="block font-display text-xs font-medium text-foreground mb-1.5">
                Duration
              </label>
              <select
                id="ap-duration"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                disabled={submitting}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 font-body text-sm text-foreground focus:outline-none focus:border-blue-500/60 focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-50"
              >
                <option value={30}>~30 s</option>
                <option value={60}>~60 s</option>
                <option value={90}>~90 s</option>
                <option value={120}>~2 min</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-6 pt-4 pb-6">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={submitting}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || !topic.trim() || submitting}
            className="flex-1"
          >
            {submitting ? (
              <>
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                Creating…
              </>
            ) : (
              'Create series'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
