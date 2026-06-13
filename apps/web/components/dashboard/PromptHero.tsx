'use client'

/**
 * PromptHero — prompt-first home hero (HeyGen pattern).
 *
 *   • Large centered title + one-line subtitle.
 *   • A white input card: auto-resizing textarea + a row of action chips and a
 *     violet "Submit" button.
 *
 * The AI assistant does NOT exist yet — this card is VISUAL. No fake AI call:
 *   • Submit → routes to the faceless wizard, passing the typed text as a
 *     `?prompt=` query param (the wizard can consume it later).
 *   • Chips route to the relevant wizard.
 *   // TODO: brancher l'assistant IA quand disponible
 */

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, User, Palette, Upload, FileText, ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n'

interface Chip {
  id:       string
  icon:     typeof User
  labelKey: string
  href:     string
}

const CHIPS: Chip[] = [
  { id: 'avatar', icon: User,     labelKey: 'home_chip_avatar', href: '/studio/new' },
  { id: 'style',  icon: Palette,  labelKey: 'home_chip_style',  href: '/faceless/new' },
  { id: 'docs',   icon: Upload,   labelKey: 'home_chip_docs',   href: '/faceless/new' },
  { id: 'script', icon: FileText, labelKey: 'home_chip_script', href: '/faceless/new' },
]

interface PromptHeroProps {
  firstName: string
}

export function PromptHero({ firstName }: PromptHeroProps) {
  const { t }  = useLanguage()
  const router = useRouter()
  const [value, setValue] = useState('')
  const taRef = useRef<HTMLTextAreaElement>(null)

  function autoResize() {
    const el = taRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }

  function submit() {
    // Visual only: hand the prompt to the faceless wizard. No AI backend.
    const trimmed = value.trim()
    const href = trimmed
      ? `/faceless/new?prompt=${encodeURIComponent(trimmed)}`
      : '/faceless/new'
    router.push(href)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <section className="text-center pt-6">
      {/* Title + subtitle */}
      <h1 className="font-display text-3xl sm:text-4xl font-semibold text-foreground tracking-tight">
        {t('home_heroTitle').replace('{name}', firstName)}
      </h1>
      <p className="mt-2 font-body text-sm sm:text-base text-[--text-secondary]">
        {t('home_heroSubtitle')}
      </p>

      {/* Input card */}
      <div className="mt-6 max-w-2xl mx-auto text-left">
        <div className="rounded-2xl border border-border/70 bg-card shadow-sm p-3 sm:p-4 focus-within:ring-2 focus-within:ring-ring/40 transition-shadow">
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

          {/* Action row */}
          <div className="mt-2 flex items-center justify-between gap-2">
            {/* Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {CHIPS.map((chip) => {
                const Icon = chip.icon
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => router.push(chip.href)}
                    className={cn(
                      'shrink-0 flex items-center gap-1.5 h-8 px-2.5 rounded-full',
                      'border border-border/70 bg-background text-xs font-body text-[--text-secondary]',
                      'hover:bg-muted hover:text-foreground transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                    )}
                  >
                    <Icon size={13} className="shrink-0 text-[--text-muted]" aria-hidden="true" />
                    {t(chip.labelKey)}
                  </button>
                )
              })}
            </div>

            {/* Submit */}
            <button
              type="button"
              onClick={submit}
              aria-label={t('home_submit')}
              className={cn(
                'shrink-0 flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-full',
                'bg-primary text-primary-foreground text-sm font-medium font-display',
                'hover:opacity-90 transition-opacity',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              )}
            >
              <Sparkles size={14} className="shrink-0 sm:hidden" aria-hidden="true" />
              <span className="hidden sm:inline">{t('home_submit')}</span>
              <ArrowUp size={15} className="shrink-0 hidden sm:inline" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
