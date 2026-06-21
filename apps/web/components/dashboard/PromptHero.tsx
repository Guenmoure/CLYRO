'use client'

/**
 * PromptHero — HeyGen-style prompt-first home hero.
 *
 *   • Large centered title: "Say it with video"
 *   • Subtitle + Auto pills (Auto Avatar, Auto Voice, Auto Style/Brand)
 *   • White input card: auto-resizing textarea + action row
 *   • Quick-action chips below the input card
 *
 * The AI assistant does NOT exist yet — this card is VISUAL. No fake AI call:
 *   • Submit → routes to the faceless wizard, passing the typed text as a
 *     `?prompt=` query param (the wizard can consume it later).
 *   • Chips route to the relevant wizard.
 *   // TODO: brancher l'assistant IA quand disponible
 */

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { User, Mic, Palette, Plus, Settings2, ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n'

// ── Auto pills — HeyGen pattern: quick toggles above the prompt ─────────────

interface AutoPill {
  id:       string
  icon:     typeof User
  labelKey: string
}

const AUTO_PILLS: AutoPill[] = [
  { id: 'avatar', icon: User,    labelKey: 'home_auto_avatar' },
  { id: 'voice',  icon: Mic,     labelKey: 'home_auto_voice' },
  { id: 'brand',  icon: Palette, labelKey: 'home_auto_brand' },
]

// ── Quick-action chips — below the prompt card ──────────────────────────────

interface Chip {
  id:       string
  labelKey: string
  href:     string
}

const CHIPS: Chip[] = [
  { id: 'avatar', labelKey: 'home_chip_avatar', href: '/studio/new' },
  { id: 'style',  labelKey: 'home_chip_style',  href: '/faceless/new' },
  { id: 'docs',   labelKey: 'home_chip_docs',   href: '/faceless/new' },
  { id: 'script', labelKey: 'home_chip_script', href: '/faceless/new' },
]

// ── Component ───────────────────────────────────────────────────────────────

interface PromptHeroProps {
  firstName: string
}

export function PromptHero({ firstName }: PromptHeroProps) {
  const { t }  = useLanguage()
  const router = useRouter()
  const [value, setValue] = useState('')
  const taRef = useRef<HTMLTextAreaElement>(null)
  const [activePills, setActivePills] = useState<Set<string>>(new Set(['avatar', 'voice', 'brand']))

  function togglePill(id: string) {
    setActivePills(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function autoResize() {
    const el = taRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }

  function submit() {
    const trimmed = value.trim()
    // Audit 19/06/26 B6 — prompt no longer travels through the URL.
    // Putting user-typed content in a query string leaks it to Vercel /
    // Render access logs and the Referer header. We stash it in
    // sessionStorage and Faceless / Studio /new read it on mount, then
    // delete the key. URL stays clean (/faceless/new).
    if (trimmed) {
      try {
        sessionStorage.setItem('clyro_pending_prompt', trimmed)
      } catch { /* sessionStorage disabled — fall back to URL */
        router.push(`/faceless/new?prompt=${encodeURIComponent(trimmed)}`)
        return
      }
    }
    router.push('/faceless/new')
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <section className="text-center pt-8 sm:pt-12">
      {/* Title — large, bold, HeyGen-style */}
      <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground tracking-tight leading-tight">
        {t('home_heroTitle')}
      </h1>
      <p className="mt-3 font-body text-sm sm:text-base text-[--text-secondary] max-w-md mx-auto">
        {t('home_heroSubtitle')}
      </p>

      {/* Auto pills — HeyGen pattern */}
      <div className="mt-5 flex items-center justify-center gap-2">
        {AUTO_PILLS.map((pill) => {
          const Icon = pill.icon
          const active = activePills.has(pill.id)
          return (
            <button
              key={pill.id}
              type="button"
              onClick={() => togglePill(pill.id)}
              className={cn(
                'flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium font-body transition-all duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                active
                  ? 'bg-primary/10 text-primary border border-primary/30'
                  : 'bg-muted text-[--text-muted] border border-transparent hover:border-border',
              )}
            >
              <Icon size={13} className="shrink-0" aria-hidden="true" />
              {t(pill.labelKey)}
            </button>
          )
        })}
      </div>

      {/* Input card */}
      <div className="mt-5 max-w-2xl mx-auto text-left">
        <div className="rounded-2xl border border-border/70 bg-card shadow-sm focus-within:ring-2 focus-within:ring-ring/40 transition-shadow">
          <div className="p-3 sm:p-4">
            <label htmlFor="prompt-hero" className="sr-only">{t('home_promptPlaceholder')}</label>
            <textarea
              id="prompt-hero"
              ref={taRef}
              rows={2}
              value={value}
              onChange={(e) => { setValue(e.target.value); autoResize() }}
              onKeyDown={onKeyDown}
              placeholder={t('home_promptPlaceholder')}
              className={cn(
                'w-full resize-none bg-transparent border-0 outline-none',
                'font-body text-sm text-foreground placeholder:text-[--text-muted]',
                'min-h-[48px] max-h-[200px]',
              )}
            />
          </div>

          {/* Action row — attachment + settings + auto-pilot + submit */}
          <div className="flex items-center justify-between gap-2 px-3 sm:px-4 pb-3">
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label={t('home_chip_docs')}
                onClick={() => router.push('/faceless/new')}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[--text-muted] hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <Plus size={16} />
              </button>
              <button
                type="button"
                aria-label="Settings"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[--text-muted] hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <Settings2 size={16} />
              </button>
            </div>

            {/* Submit */}
            <button
              type="button"
              onClick={submit}
              aria-label={t('home_submit')}
              className={cn(
                'shrink-0 flex items-center justify-center gap-1.5 h-9 px-4 rounded-full',
                'bg-foreground text-background text-sm font-medium font-display',
                'hover:opacity-90 transition-opacity',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              )}
            >
              {t('home_submit')}
              <ArrowUp size={14} className="shrink-0" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Example prompt chips — audit 16/06/26: the audit asked for « 2-3
          example prompts under the input ». Clicking one fills the textarea
          so the user sees concretely what the agent expects. Each example
          is a translation key so it adapts to the UI language. */}
      <div className="mt-4 flex flex-col items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-[--text-muted]">
          {t('home_example_label')}
        </span>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {['home_example_1', 'home_example_2', 'home_example_3'].map((k) => {
            const example = t(k)
            return (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setValue(example)
                  // Resize the textarea on next tick so the height grows
                  // to fit the freshly injected text.
                  requestAnimationFrame(() => {
                    autoResize()
                    taRef.current?.focus()
                  })
                }}
                className={cn(
                  'shrink-0 max-w-xs text-left flex items-start gap-1.5 px-3 py-2 rounded-2xl',
                  'border border-dashed border-border/70 bg-card text-[11px] font-body text-[--text-secondary]',
                  'hover:bg-muted hover:text-foreground hover:border-brand/40 transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                )}
              >
                <span className="line-clamp-2 leading-snug">{example}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Category chips — wizard shortcuts (kept below the examples). */}
      <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
        {CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => router.push(chip.href)}
            className={cn(
              'shrink-0 flex items-center gap-1.5 h-8 px-3.5 rounded-full',
              'border border-border/70 bg-card text-xs font-body text-[--text-secondary]',
              'hover:bg-muted hover:text-foreground hover:border-border transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
            )}
          >
            {t(chip.labelKey)}
          </button>
        ))}
      </div>
    </section>
  )
}
