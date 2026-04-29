'use client'

/**
 * QuickActions — 4 creation cards on one row (2×2 on mobile).
 * Replaces the 7-card FeatureCards grid.
 */

import { Film, Video, Sparkles, Palette, ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n'

const ACTIONS = [
  {
    id:        'avatar',
    icon:      Film,
    labelKey:  'qa_avatar_label',
    tagKey:    'qa_avatar_tag',
    href:      '/studio/new',
    gradient:  'from-pink-500/10 to-pink-500/3',
    iconBg:    'bg-pink-500/15',
    iconColor: 'text-pink-500',
    tagColor:  'text-pink-500/60',
  },
  {
    id:        'faceless',
    icon:      Video,
    labelKey:  'qa_faceless_label',
    tagKey:    'qa_faceless_tag',
    href:      '/faceless/new',
    gradient:  'from-blue-500/10 to-blue-500/3',
    iconBg:    'bg-blue-500/15',
    iconColor: 'text-blue-500',
    tagColor:  'text-blue-500/60',
  },
  {
    id:        'motion',
    icon:      Sparkles,
    labelKey:  'qa_motion_label',
    tagKey:    'qa_motion_tag',
    href:      '/motion/new',
    gradient:  'from-purple-500/10 to-purple-500/3',
    iconBg:    'bg-purple-500/15',
    iconColor: 'text-purple-500',
    tagColor:  'text-purple-500/60',
  },
  {
    id:        'brand',
    icon:      Palette,
    labelKey:  'qa_brand_label',
    tagKey:    'qa_brand_tag',
    href:      '/brand',
    gradient:  'from-teal-500/10 to-teal-500/3',
    iconBg:    'bg-teal-500/15',
    iconColor: 'text-teal-500',
    tagColor:  'text-teal-500/60',
  },
]

export function QuickActions() {
  const router = useRouter()
  const { t } = useLanguage()

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {ACTIONS.map(a => {
        const Icon = a.icon
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => router.push(a.href)}
            className={cn(
              'relative group p-4 rounded-2xl text-left border',
              'bg-gradient-to-br',
              a.gradient,
              'border-border/60 hover:border-border',
              'hover:shadow-md transition-all duration-200',
              'active:scale-[0.98]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            )}
          >
            {/* Icon */}
            <div className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center mb-3',
              a.iconBg,
              'group-hover:scale-110 transition-transform duration-200',
            )}>
              <Icon size={18} className={a.iconColor} />
            </div>

            {/* Tag + label */}
            <p className={cn('text-[10px] font-mono font-medium uppercase tracking-wider mb-1', a.tagColor)}>
              {t(a.tagKey)}
            </p>
            <p className="font-display text-sm font-semibold text-foreground">
              {t(a.labelKey)}
            </p>

            {/* Arrow on hover */}
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <ArrowRight size={13} className="text-[--text-muted]" />
            </div>
          </button>
        )
      })}
    </div>
  )
}
