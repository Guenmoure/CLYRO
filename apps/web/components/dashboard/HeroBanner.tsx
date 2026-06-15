'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronLeft, ChevronRight, Mic2, Video, Palette } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n'

interface SlideConfig {
  badgeKey: string
  prefixKey: string
  accentKey: string
  descKey: string
  ctaKey: string
  ctaHref: string
  gradient: string
  glow: string
  icon: React.ElementType
  accentClass: string
}

const SLIDE_CONFIGS: SlideConfig[] = [
  {
    badgeKey: 'hb_badge1',
    prefixKey: 'hb_title1Prefix',
    accentKey: 'hb_title1Accent',
    descKey: 'hb_desc1',
    ctaKey: 'hb_cta1',
    ctaHref: '/voices',
    gradient: 'from-brand/20 via-violet-500/15 to-transparent',
    glow: 'bg-gradient-to-br from-brand/30 to-violet-600/30',
    icon: Mic2,
    accentClass: 'bg-gradient-to-r from-violet-400 to-purple-500 bg-clip-text text-transparent',
  },
  {
    badgeKey: 'hb_badge2',
    prefixKey: 'hb_title2Prefix',
    accentKey: 'hb_title2Accent',
    descKey: 'hb_desc2',
    ctaKey: 'hb_cta2',
    ctaHref: '/faceless/new',
    gradient: 'from-primary/20 via-secondary/15 to-transparent',
    glow: 'bg-gradient-to-br from-primary/30 to-secondary/30',
    icon: Video,
    accentClass: 'gradient-text',
  },
  {
    badgeKey: 'hb_badge3',
    prefixKey: 'hb_title3Prefix',
    accentKey: 'hb_title3Accent',
    descKey: 'hb_desc3',
    ctaKey: 'hb_cta3',
    ctaHref: '/brand',
    gradient: 'from-purple-500/20 via-pink-500/15 to-transparent',
    glow: 'bg-gradient-to-br from-purple-500/30 to-pink-600/30',
    icon: Palette,
    accentClass: 'bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent',
  },
]

const ROTATION_INTERVAL = 6000

export function HeroBanner() {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const { t } = useLanguage()

  const next = useCallback(() => setIndex((i) => (i + 1) % SLIDE_CONFIGS.length), [])
  const prev = useCallback(() => setIndex((i) => (i - 1 + SLIDE_CONFIGS.length) % SLIDE_CONFIGS.length), [])
  const goTo = useCallback((i: number) => setIndex(i), [])

  useEffect(() => {
    if (paused) return
    const timer = setInterval(next, ROTATION_INTERVAL)
    return () => clearInterval(timer)
  }, [next, paused])

  const slide = SLIDE_CONFIGS[index]
  const Icon = slide.icon

  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-border/60 bg-card"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Animated gradient background */}
      <div className={cn('absolute inset-0 bg-gradient-to-br opacity-90 transition-all duration-1000', slide.gradient)} />

      {/* Decorative glow blob */}
      <div className={cn('absolute -right-20 -top-20 h-80 w-80 rounded-full blur-3xl opacity-60 transition-all duration-1000', slide.glow)} />
      <div className="absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-brand/10 blur-3xl" />

      {/* Subtle grid overlay */}
      <div className="absolute inset-0 grid-bg opacity-[0.04]" />

      {/* Content */}
      <div className="relative px-8 py-10 md:px-12 md:py-14">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex-1 min-w-0 space-y-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-sm px-3 py-1 text-[11px] font-mono uppercase tracking-widest text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              {t(slide.badgeKey)}
            </span>

            <h1 key={index} className="font-display text-3xl md:text-4xl lg:text-5xl text-white leading-tight max-w-2xl animate-fade-up">
              {t(slide.prefixKey)}{' '}
              <span className={slide.accentClass}>
                {t(slide.accentKey)}
              </span>
            </h1>

            <p key={`desc-${index}`} className="font-body text-sm md:text-base text-white/70 max-w-xl animate-fade-up reveal-delay-200">
              {t(slide.descKey)}
            </p>

            <div className="flex items-center gap-3 pt-2 animate-fade-up reveal-delay-400">
              <Link
                href={slide.ctaHref}
                className="group inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 font-display text-sm font-semibold text-gray-950 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
              >
                {t(slide.ctaKey)}
                <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>

          {/* Floating icon visual (hidden on mobile) */}
          <div className="hidden md:flex items-center justify-center shrink-0">
            <div className="relative">
              <div className={cn('absolute inset-0 rounded-3xl blur-2xl', slide.glow)} />
              <div className="relative h-28 w-28 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
                <Icon size={44} className="text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Slider controls */}
        <div className="absolute right-6 bottom-6 flex items-center gap-2">
          {/* Progress bar + dots */}
          <div className="flex flex-col items-end gap-2 mr-3">
            <div className="w-24 h-0.5 bg-white/10 rounded-full overflow-hidden">
              <div
                key={`pb-${index}`}
                className={cn(
                  'h-full bg-white/60 rounded-full banner-progress',
                  paused && '[animation-play-state:paused]',
                )}
              />
            </div>
            <div className="flex items-center gap-1.5">
              {SLIDE_CONFIGS.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={`Slide ${i + 1}`}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300',
                    i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/30 hover:bg-white/50',
                  )}
                />
              ))}
            </div>
          </div>
          <button
            onClick={prev}
            aria-label={t('hb_prevSlide')}
            className="h-9 w-9 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={next}
            aria-label={t('hb_nextSlide')}
            className="h-9 w-9 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
