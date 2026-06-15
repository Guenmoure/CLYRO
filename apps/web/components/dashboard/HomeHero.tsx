'use client'

/**
 * HomeHero — HeyGen-style hero banner for the dashboard home.
 *
 * Layout (matches HeyGen 2026 home reference) :
 *   ┌───────────────────────────────────────────────────────────────────┐
 *   │  <            Avatar V is here.                              >    │
 *   │     Create ultra-realistic videos trained on your real footage    │
 *   │             [ NEW · Try it now → ]                                │
 *   └───────────────────────────────────────────────────────────────────┘
 *
 *   - Soft pastel-gradient background (blue → pink → mint), NOT a dark
 *     hero with a colored CTA — that broke the "clean & airy" HeyGen feel.
 *   - One visible slide at a time, auto-rotates every 7s. Pause on hover.
 *   - Left / right arrows allow manual navigation; dots are intentionally
 *     omitted (HeyGen doesn't show them either — keeps the banner serene).
 *   - The title's "highlight word" gets a multi-stop gradient text fill
 *     to match the "Avatar V" treatment.
 */

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n'

interface SlideConfig {
  prefixKey:  string
  accentKey:  string
  suffixKey:  string
  descKey:    string
  badgeKey:   string
  ctaKey:     string
  ctaHref:    string
}

const SLIDE_CONFIGS: SlideConfig[] = [
  {
    prefixKey: 'hh_s1Prefix',
    accentKey: 'hh_s1Accent',
    suffixKey: 'hh_s1Suffix',
    descKey:   'hh_s1Desc',
    badgeKey:  'hh_s1Badge',
    ctaKey:    'hh_s1Cta',
    ctaHref:   '/studio/new',
  },
  {
    prefixKey: 'hh_s2Prefix',
    accentKey: 'hh_s2Accent',
    suffixKey: 'hh_s2Suffix',
    descKey:   'hh_s2Desc',
    badgeKey:  'hh_s2Badge',
    ctaKey:    'hh_s2Cta',
    ctaHref:   '/voices',
  },
  {
    prefixKey: 'hh_s3Prefix',
    accentKey: 'hh_s3Accent',
    suffixKey: 'hh_s3Suffix',
    descKey:   'hh_s3Desc',
    badgeKey:  'hh_s3Badge',
    ctaKey:    'hh_s3Cta',
    ctaHref:   '/brand',
  },
]

const ROTATION_MS = 7000

export function HomeHero() {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const { t } = useLanguage()

  const next = useCallback(() => setIndex((i) => (i + 1) % SLIDE_CONFIGS.length), [])
  const prev = useCallback(() => setIndex((i) => (i - 1 + SLIDE_CONFIGS.length) % SLIDE_CONFIGS.length), [])

  useEffect(() => {
    if (paused) return
    const id = setInterval(next, ROTATION_MS)
    return () => clearInterval(id)
  }, [next, paused])

  const slide = SLIDE_CONFIGS[index]

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-3xl',
        'border border-border/40',
        'bg-[linear-gradient(115deg,rgba(173,201,255,0.55)_0%,rgba(245,212,225,0.45)_50%,rgba(199,242,224,0.45)_100%)]',
        'dark:bg-[linear-gradient(115deg,rgba(70,90,150,0.30)_0%,rgba(140,80,110,0.25)_50%,rgba(70,140,110,0.25)_100%)]',
      )}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Subtle inner highlight + grain for premium feel */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-20%,rgba(255,255,255,0.6),transparent_60%)] dark:bg-[radial-gradient(ellipse_at_50%_-20%,rgba(255,255,255,0.05),transparent_60%)]" />

      <div className="relative px-6 py-12 md:px-14 md:py-16 text-center">

        {/* Title — multi-line so the accent gradient sits centred */}
        <h2
          key={`title-${index}`}
          className="font-display text-3xl md:text-5xl lg:text-[44px] leading-tight tracking-tight text-foreground animate-fade-up"
        >
          <span>{t(slide.prefixKey)}</span>
          <span className="bg-gradient-to-r from-[#6D4AFF] via-[#8B5CF6] to-[#C168EE] bg-clip-text text-transparent font-extrabold">
            {t(slide.accentKey)}
          </span>
          <span>{t(slide.suffixKey)}</span>
        </h2>

        {/* Subtitle */}
        <p
          key={`desc-${index}`}
          className="mt-4 max-w-2xl mx-auto text-sm md:text-base text-[--text-secondary] font-body animate-fade-up reveal-delay-200"
        >
          {t(slide.descKey)}
        </p>

        {/* NEW · CTA pill */}
        <div className="mt-7 flex items-center justify-center animate-fade-up reveal-delay-400">
          <Link
            href={slide.ctaHref}
            className={cn(
              'group inline-flex items-center gap-2 pl-1 pr-4 py-1 rounded-full',
              'bg-white/70 dark:bg-white/10 backdrop-blur-sm',
              'border border-white/60 dark:border-white/15',
              'shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(0,0,0,0.08)]',
              'hover:shadow-[0_2px_4px_rgba(0,0,0,0.06),0_12px_32px_-8px_rgba(0,0,0,0.12)]',
              'hover:scale-[1.02] active:scale-[0.98] transition-all duration-200',
            )}
          >
            <span className="inline-flex items-center justify-center h-7 px-3 rounded-full bg-foreground text-background text-[11px] font-bold tracking-wider uppercase">
              {t(slide.badgeKey)}
            </span>
            <span className="font-display text-sm font-semibold text-foreground">
              {t(slide.ctaKey)}
            </span>
            <ChevronRight size={14} className="text-foreground/60 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* Carousel arrows — floated on the sides, vertically centered */}
        <button
          type="button"
          onClick={prev}
          aria-label={t('hh_prev')}
          className="absolute left-3 md:left-5 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/60 dark:bg-white/10 backdrop-blur-sm border border-white/60 dark:border-white/15 flex items-center justify-center text-foreground/70 hover:text-foreground hover:bg-white/90 dark:hover:bg-white/20 transition-all"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          onClick={next}
          aria-label={t('hh_next')}
          className="absolute right-3 md:right-5 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/60 dark:bg-white/10 backdrop-blur-sm border border-white/60 dark:border-white/15 flex items-center justify-center text-foreground/70 hover:text-foreground hover:bg-white/90 dark:hover:bg-white/20 transition-all"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
