'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronLeft, ChevronRight, Mic2, Video, Palette } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Slide {
  badge?: string
  title: React.ReactNode
  description: string
  ctaLabel: string
  ctaHref: string
  gradient: string
  glow: string
  icon: React.ElementType
}

const SLIDES: Slide[] = [
  {
    badge: 'NOUVEAU',
    title: (
      <>
        Une voix.{' '}
        <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          Des vidéos sans limites.
        </span>
      </>
    ),
    description: 'Clone ta voix une seule fois et génère des vidéos faceless illimitées en quelques minutes.',
    ctaLabel: 'Cloner ma voix',
    ctaHref: '/voices',
    gradient: 'from-blue-500/20 via-purple-500/15 to-transparent',
    glow: 'bg-gradient-to-br from-blue-500/30 to-purple-600/30',
    icon: Mic2,
  },
  {
    badge: 'PIPELINE COMPLET',
    title: (
      <>
        Du script à la vidéo.{' '}
        <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
          En 5 étapes.
        </span>
      </>
    ),
    description: 'Script → Storyboard → Images → Clips → Vidéo finale. Tout est automatisé, tu gardes le contrôle.',
    ctaLabel: 'Créer une vidéo Faceless',
    ctaHref: '/faceless/new',
    gradient: 'from-cyan-500/20 via-blue-500/15 to-transparent',
    glow: 'bg-gradient-to-br from-cyan-500/30 to-blue-600/30',
    icon: Video,
  },
  {
    badge: 'BRAND KIT',
    title: (
      <>
        Une identité visuelle{' '}
        <span className="bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
          générée par IA.
        </span>
      </>
    ),
    description: 'Logo, palette, typographie, charte — tout en un clic. Ta marque, prête à exister.',
    ctaLabel: 'Construire mon brand kit',
    ctaHref: '/brand',
    gradient: 'from-purple-500/20 via-pink-500/15 to-transparent',
    glow: 'bg-gradient-to-br from-purple-500/30 to-pink-600/30',
    icon: Palette,
  },
]

const ROTATION_INTERVAL = 6000

export function HeroBanner() {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  const next = useCallback(() => setIndex((i) => (i + 1) % SLIDES.length), [])
  const prev = useCallback(() => setIndex((i) => (i - 1 + SLIDES.length) % SLIDES.length), [])
  const goTo = useCallback((i: number) => setIndex(i), [])

  useEffect(() => {
    if (paused) return
    const timer = setInterval(next, ROTATION_INTERVAL)
    return () => clearInterval(timer)
  }, [next, paused])

  const slide = SLIDES[index]
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
      <div className="absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

      {/* Subtle grid overlay */}
      <div className="absolute inset-0 grid-bg opacity-[0.04]" />

      {/* Content */}
      <div className="relative px-8 py-10 md:px-12 md:py-14">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex-1 min-w-0 space-y-4">
            {slide.badge && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-sm px-3 py-1 text-[11px] font-mono uppercase tracking-widest text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                {slide.badge}
              </span>
            )}

            <h1 key={index} className="font-display text-3xl md:text-4xl lg:text-5xl text-white leading-tight max-w-2xl animate-fade-up">
              {slide.title}
            </h1>

            <p key={`desc-${index}`} className="font-body text-sm md:text-base text-white/70 max-w-xl animate-fade-up reveal-delay-200">
              {slide.description}
            </p>

            <div className="flex items-center gap-3 pt-2 animate-fade-up reveal-delay-400">
              <Link
                href={slide.ctaHref}
                className="group inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 font-display text-sm font-semibold text-gray-950 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
              >
                {slide.ctaLabel}
                <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>

          {/* Floating icon visual (hidden on mobile) */}
          <div className="hidden md:flex items-center justify-center shrink-0">
            <div className="relative">
              <div className={cn('absolute inset-0 rounded-3xl blur-2xl', slide.glow)} />
              <div className="relative h-28 w-28 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center animate-glow-pulse">
                <Icon size={44} className="text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Slider controls */}
        <div className="absolute right-6 bottom-6 flex items-center gap-2">
          {/* Progress bar + dots */}
          <div className="flex flex-col items-end gap-2 mr-3">
            {/* Progress bar — CSS keyframe resets on slide change via key */}
            <div className="w-24 h-0.5 bg-white/10 rounded-full overflow-hidden">
              <div
                key={`pb-${index}`}
                className={cn(
                  'h-full bg-white/60 rounded-full banner-progress',
                  paused && '[animation-play-state:paused]',
                )}
              />
            </div>
            {/* Dots */}
            <div className="flex items-center gap-1.5">
              {SLIDES.map((_, i) => (
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
            aria-label="Slide précédent"
            className="h-9 w-9 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={next}
            aria-label="Slide suivant"
            className="h-9 w-9 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
