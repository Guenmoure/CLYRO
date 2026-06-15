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
import { useLanguage } from '@/lib/i18n'

interface Card {
  id:        string
  icon:      LucideIcon
  titleKey:  string
  descKey:   string
  href:      string
  iconClass: string
  iconBg:    string
  ringClass: string
}

const CARDS: Card[] = [
  {
    id:        'scene',
    icon:      Clapperboard,
    titleKey:  'hfg_sceneTitle',
    descKey:   'hfg_sceneDesc',
    href:      '/studio/new',
    iconClass: 'text-sky-500',
    iconBg:    'bg-sky-500/12',
    ringClass: 'group-hover:ring-sky-500/30',
  },
  {
    id:        'prompt',
    icon:      Wand2,
    titleKey:  'hfg_promptTitle',
    descKey:   'hfg_promptDesc',
    href:      '/faceless/new',
    iconClass: 'text-cyan-500',
    iconBg:    'bg-cyan-500/12',
    ringClass: 'group-hover:ring-cyan-500/30',
  },
  {
    id:        'photo',
    icon:      ImagePlay,
    titleKey:  'hfg_photoTitle',
    descKey:   'hfg_photoDesc',
    href:      '/motion/new',
    iconClass: 'text-slate-500',
    iconBg:    'bg-slate-500/12',
    ringClass: 'group-hover:ring-slate-500/30',
  },
  {
    id:        'voice',
    icon:      Mic2,
    titleKey:  'hfg_voiceTitle',
    descKey:   'hfg_voiceDesc',
    href:      '/voices',
    iconClass: 'text-blue-500',
    iconBg:    'bg-blue-500/12',
    ringClass: 'group-hover:ring-blue-500/30',
  },
  {
    id:        'brand',
    icon:      Palette,
    titleKey:  'hfg_brandTitle',
    descKey:   'hfg_brandDesc',
    href:      '/brand',
    iconClass: 'text-emerald-500',
    iconBg:    'bg-emerald-500/12',
    ringClass: 'group-hover:ring-emerald-500/30',
  },
  {
    id:        'template',
    icon:      LayoutTemplate,
    titleKey:  'hfg_templateTitle',
    descKey:   'hfg_templateDesc',
    href:      '/templates',
    iconClass: 'text-slate-500',
    iconBg:    'bg-slate-500/12',
    ringClass: 'group-hover:ring-slate-500/30',
  },
]

export function HomeFeatureGrid() {
  const router = useRouter()
  const { t } = useLanguage()
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
              'hover:-translate-y-0.5 hover:border-border/70 hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.10)]',
              'active:translate-y-0',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]',
            )}
          >
            <div className={cn(
              'w-11 h-11 rounded-xl mb-5 flex items-center justify-center',
              card.iconBg,
            )}>
              <Icon size={20} className={card.iconClass} strokeWidth={1.8} />
            </div>

            <h3 className="font-display text-[15px] font-semibold text-foreground leading-snug">
              {t(card.titleKey)}
            </h3>

            <p className="mt-2 font-body text-[13px] text-[--text-muted] leading-relaxed">
              {t(card.descKey)}
            </p>
          </button>
        )
      })}
    </div>
  )
}
