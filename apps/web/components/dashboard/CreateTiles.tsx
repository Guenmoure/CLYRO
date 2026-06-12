'use client'

/**
 * CreateTiles — HeyGen-style creation row for the dashboard home.
 *
 * One large tile per CLYRO module: Faceless, Motion, Studio (avatar),
 * Brand, Autopilot. Each tile links to the module's wizard and shows
 * icon + title + one-line subtitle + an arrow on hover/focus.
 *
 * Identity: CLYRO tokens only — `feature.*` accents from tailwind.config,
 * card/border/text tokens from globals.css. All strings via t() (npd_* keys).
 */

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import {
  Video, Sparkles, Clapperboard, Palette, Rocket, ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n'

interface Tile {
  id:        string
  icon:      LucideIcon
  titleKey:  string
  descKey:   string
  href:      string
  /** Module accent — `feature.*` tokens from tailwind.config.ts */
  iconClass: string
  iconBg:    string
}

const TILES: Tile[] = [
  {
    id:        'faceless',
    icon:      Video,
    titleKey:  'npd_faceless_title',
    descKey:   'npd_faceless_desc',
    href:      '/faceless/new',
    iconClass: 'text-feature-faceless',
    iconBg:    'bg-feature-faceless/10',
  },
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
    id:        'studio',
    icon:      Clapperboard,
    titleKey:  'npd_avatar_title',
    descKey:   'npd_avatar_desc',
    href:      '/studio/new',
    iconClass: 'text-feature-avatar',
    iconBg:    'bg-feature-avatar/10',
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
    <nav aria-label={t('sb_create')}>
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 list-none p-0 m-0">
        {TILES.map((tile) => {
          const Icon = tile.icon
          return (
            <li key={tile.id}>
              <Link
                href={tile.href}
                className={cn(
                  'group relative flex flex-col h-full p-5 rounded-2xl',
                  'bg-card border border-border/60 card-interactive',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                )}
              >
                {/* Icon square */}
                <div
                  className={cn(
                    'w-10 h-10 rounded-xl mb-4 flex items-center justify-center shrink-0',
                    tile.iconBg,
                  )}
                  aria-hidden="true"
                >
                  <Icon size={20} className={tile.iconClass} strokeWidth={1.8} />
                </div>

                {/* Title */}
                <h3 className="font-display text-sm font-semibold text-foreground leading-snug">
                  {t(tile.titleKey)}
                </h3>

                {/* One-line subtitle */}
                <p className="mt-1 font-body text-xs text-[--text-muted] leading-relaxed line-clamp-2">
                  {t(tile.descKey)}
                </p>

                {/* Hover/focus arrow */}
                <ArrowRight
                  size={16}
                  aria-hidden="true"
                  className={cn(
                    'absolute top-5 right-5 text-[--text-muted]',
                    'opacity-0 -translate-x-1 transition-all duration-150',
                    'group-hover:opacity-100 group-hover:translate-x-0',
                    'group-focus-visible:opacity-100 group-focus-visible:translate-x-0',
                  )}
                />
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
