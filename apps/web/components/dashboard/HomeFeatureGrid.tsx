'use client'

/**
 * HomeFeatureGrid — 3×2 product-entry cards for the dashboard home.
 *
 * Layout mirrors HeyGen's home grid :
 *   ┌─────────────────┬─────────────────┬─────────────────┐
 *   │ Build scene…    │ Generate from   │ Animate a       │
 *   │                 │   a prompt      │   photo         │
 *   ├─────────────────┼─────────────────┼─────────────────┤
 *   │ Clone your voice│ Build your      │ Start with a    │
 *   │                 │   brand kit     │   template      │
 *   └─────────────────┴─────────────────┴─────────────────┘
 *
 * Each card is intentionally light :
 *   - no heavy shadows
 *   - soft tinted icon square (10 % alpha of the icon hue)
 *   - thin border, almost transparent
 *   - hover lifts subtly + brightens the border
 *
 * The card content is bilingual via /lib/i18n's `t(<key>)` so the existing
 * keys keep working. New `home_card_*` keys are added in lib/i18n/en.ts and
 * the other locales.
 */

import { useRouter } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import {
  Clapperboard,
  Wand2,
  ImagePlay,
  Mic2,
  Palette,
  LayoutTemplate,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Card {
  id:        string
  icon:      LucideIcon
  title:     string
  desc:      string
  href:      string
  /** Tailwind text color class for the icon, e.g. `text-sky-500`. */
  iconClass: string
  /** Tailwind background tint for the icon square, e.g. `bg-sky-500/10`. */
  iconBg:    string
  /** Tailwind ring color used on hover to hint at the card's hue. */
  ringClass: string
}

const CARDS: Card[] = [
  {
    id:        'scene',
    icon:      Clapperboard,
    title:     'Build a video scene by scene',
    desc:      'Take full control over your avatar, script, scenes, layout, and more.',
    href:      '/studio/new',
    iconClass: 'text-sky-500',
    iconBg:    'bg-sky-500/12',
    ringClass: 'group-hover:ring-sky-500/30',
  },
  {
    id:        'prompt',
    icon:      Wand2,
    title:     'Generate a video from a prompt',
    desc:      'AI writes the script, creates b-roll, voices it over, and assembles the cut.',
    href:      '/faceless/new',
    iconClass: 'text-cyan-500',
    iconBg:    'bg-cyan-500/12',
    ringClass: 'group-hover:ring-cyan-500/30',
  },
  {
    id:        'photo',
    icon:      ImagePlay,
    title:     'Animate a photo into a video',
    desc:      'Turn a still image into a dynamic clip with Kling, Wan, or Runway.',
    href:      '/motion/new',
    iconClass: 'text-slate-500',
    iconBg:    'bg-slate-500/12',
    ringClass: 'group-hover:ring-slate-500/30',
  },
  {
    id:        'voice',
    icon:      Mic2,
    title:     'Clone your AI voice',
    desc:      'Record, upload, or describe — bring your voice to life in 17 languages.',
    href:      '/voices',
    iconClass: 'text-blue-500',
    iconBg:    'bg-blue-500/12',
    ringClass: 'group-hover:ring-blue-500/30',
  },
  {
    id:        'brand',
    icon:      Palette,
    title:     'Build your brand kit',
    desc:      'Logo, palette, typography and tone — a visual identity, on demand.',
    href:      '/brand',
    iconClass: 'text-emerald-500',
    iconBg:    'bg-emerald-500/12',
    ringClass: 'group-hover:ring-emerald-500/30',
  },
  {
    id:        'template',
    icon:      LayoutTemplate,
    title:     'Start with a template',
    desc:      'Ready-made layouts for presentations, explainers, hooks, and more.',
    href:      '/templates',
    iconClass: 'text-slate-500',
    iconBg:    'bg-slate-500/12',
    ringClass: 'group-hover:ring-slate-500/30',
  },
]

export function HomeFeatureGrid() {
  const router = useRouter()
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {CARDS.map((card) => {
        const Icon = card.icon
        return (
          <button
            key={card.id}
            type="button"
            onClick={() => router.push(card.href)}
            className={cn(
              'group relative text-left p-6 rounded-2xl',
              'bg-card border border-border/40',
              'ring-1 ring-transparent transition-all duration-200',
              card.ringClass,
              // Soft float on hover — no aggressive shadow, just a lift.
              'hover:-translate-y-0.5 hover:border-border/70 hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.10)]',
              'active:translate-y-0',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]',
            )}
          >
            {/* Icon square */}
            <div className={cn(
              'w-11 h-11 rounded-xl mb-5 flex items-center justify-center',
              card.iconBg,
            )}>
              <Icon size={20} className={card.iconClass} strokeWidth={1.8} />
            </div>

            {/* Title */}
            <h3 className="font-display text-[15px] font-semibold text-foreground leading-snug">
              {card.title}
            </h3>

            {/* Description */}
            <p className="mt-2 font-body text-[13px] text-[--text-muted] leading-relaxed">
              {card.desc}
            </p>
          </button>
        )
      })}
    </div>
  )
}
