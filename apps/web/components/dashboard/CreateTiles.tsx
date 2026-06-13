'use client'

/**
 * CreateTiles — HeyGen-style large feature cards for the dashboard home.
 *
 * Two large hero cards + smaller tiles below, matching HeyGen's
 * "Create an Avatar" / "One Shot Edit" pattern. Each card links to
 * the module's wizard. Uses gradient overlays for visual impact.
 *
 * Identity: CLYRO tokens only — `feature.*` accents from tailwind.config,
 * card/border/text tokens from globals.css. All strings via t().
 */

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import {
  Clapperboard, Video, Sparkles, Palette, Rocket, ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n'

// ── Hero cards (large, 2-column) ────────────────────────────────────────────

interface HeroCard {
  id:        string
  icon:      LucideIcon
  titleKey:  string
  descKey:   string
  href:      string
  gradient:  string
}

const HERO_CARDS: HeroCard[] = [
  {
    id:       'studio',
    icon:     Clapperboard,
    titleKey: 'npd_avatar_title',
    descKey:  'npd_avatar_desc',
    href:     '/studio/new',
    gradient: 'from-emerald-500/90 to-teal-600/90',
  },
  {
    id:       'faceless',
    icon:     Video,
    titleKey: 'npd_faceless_title',
    descKey:  'npd_faceless_desc',
    href:     '/faceless/new',
    gradient: 'from-violet-500/90 to-purple-600/90',
  },
]

// ── Secondary tiles (smaller, 3-column) ─────────────────────────────────────

interface Tile {
  id:        string
  icon:      LucideIcon
  titleKey:  string
  descKey:   string
  href:      string
  iconClass: string
  iconBg:    string
}

const TILES: Tile[] = [
  {
    id:        'motion',
    icon:      Sparkles,
    titleKey:  'npd_motion_title',
    descKey:   'npd_motion_desc',
    href:      '/motion/new',
    iconClass: 'text-feature-motion',
    iconBg:    'bg-feature-motion/10',
  },
  {
    id:        'brand',
    icon:      Palette,
    titleKey:  'npd_brand_title',
    descKey:   'npd_brand_desc',
    href:      '/brand/new',
    iconClass: 'text-feature-brand',
    iconBg:    'bg-feature-brand/10',
  },
  {
    id:        'autopilot',
    icon:      Rocket,
    titleKey:  'npd_autopilot_title',
    descKey:   'npd_autopilot_desc',
    href:      '/autopilot',
    iconClass: 'text-feature-autopilot',
    iconBg:    'bg-feature-autopilot/10',
  },
]

export function CreateTiles() {
  const { t } = useLanguage()

  return (
    <div className="space-y-4">
      {/* Hero cards — large, gradient overlay, 2-column */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {HERO_CARDS.map((card) => {
          const Icon = card.icon
          return (
            <Link
              key={card.id}
              href={card.href}
              className={cn(
                'group relative flex flex-col justify-end h-44 sm:h-52 rounded-2xl overflow-hidden',
                'bg-gradient-to-br', card.gradient,
                'hover:shadow-lg transition-shadow duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              )}
            >
              {/* Decorative icon */}
              <Icon
                size={120}
                strokeWidth={0.7}
                className="absolute -top-4 -right-4 text-white/10"
                aria-hidden="true"
              />

              {/* Content */}
              <div className="relative z-10 p-5 sm:p-6">
                <h3 className="font-display text-xl sm:text-2xl font-bold text-white leading-tight">
                  {t(card.titleKey)}
                </h3>
                <p className="mt-1 font-body text-sm text-white/70 line-clamp-2">
                  {t(card.descKey)}
                </p>
              </div>

              {/* Hover arrow */}
              <ArrowRight
                size={20}
                aria-hidden="true"
                className={cn(
                  'absolute top-5 right-5 text-white/50',
                  'opacity-0 -translate-x-1 transition-all duration-150',
                  'group-hover:opacity-100 group-hover:translate-x-0',
                )}
              />
            </Link>
          )
        })}
      </div>

      {/* Secondary tiles — smaller cards */}
      <nav aria-label={t('sb_create')}>
        <ul className="grid grid-cols-1 sm:grid-cols-3 gap-4 list-none p-0 m-0">
          {TILES.map((tile) => {
            const Icon = tile.icon
            return (
              <li key={tile.id}>
                <Link
                  href={tile.href}
                  className={cn(
                    'group relative flex items-center gap-4 h-full p-4 rounded-2xl',
                    'bg-card border border-border/60 card-interactive',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                  )}
                >
                  {/* Icon square */}
                  <div
                    className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                      tile.iconBg,
                    )}
                    aria-hidden="true"
                  >
                    <Icon size={20} className={tile.iconClass} strokeWidth={1.8} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-display text-sm font-semibold text-foreground leading-snug">
                      {t(tile.titleKey)}
                    </h3>
                    <p className="mt-0.5 font-body text-xs text-[--text-muted] leading-relaxed line-clamp-1">
                      {t(tile.descKey)}
                    </p>
                  </div>

                  <ArrowRight
                    size={16}
                    aria-hidden="true"
                    className={cn(
                      'shrink-0 text-[--text-muted]',
                      'opacity-0 -translate-x-1 transition-all duration-150',
                      'group-hover:opacity-100 group-hover:translate-x-0',
                    )}
                  />
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
