import Link from 'next/link'
import {
  Video, Sparkles, Palette, Mic2, Image as ImageIcon, History, Film,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n'

interface Feature {
  id: string
  catKey: string
  titleKey: string
  descKey: string
  href: string
  icon: React.ElementType
  iconColor: string
  iconBg: string
  iconRing: string
  hoverGlow: string
}

const FEATURES: Feature[] = [
  {
    id: 'avatar',
    catKey: 'fc_catAvatar',
    titleKey: 'fc_avatarTitle',
    descKey: 'fc_avatarDesc',
    href: '/studio/new',
    icon: Film,
    iconColor: 'text-rose-400',
    iconBg: 'bg-rose-500/10',
    iconRing: 'ring-rose-500/30',
    hoverGlow: 'hover:shadow-[0_0_40px_-10px_rgba(251,113,133,0.3)]',
  },
  {
    id: 'faceless',
    catKey: 'fc_catStudio',
    titleKey: 'fc_facelessTitle',
    descKey: 'fc_facelessDesc',
    href: '/faceless/new',
    icon: Video,
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-500/10',
    iconRing: 'ring-blue-500/30',
    hoverGlow: 'hover:shadow-[0_0_40px_-10px_rgba(59,142,240,0.3)]',
  },
  {
    id: 'motion',
    catKey: 'fc_catAnimation',
    titleKey: 'fc_motionTitle',
    descKey: 'fc_motionDesc',
    href: '/motion/new',
    icon: Sparkles,
    iconColor: 'text-purple-400',
    iconBg: 'bg-purple-500/10',
    iconRing: 'ring-purple-500/30',
    hoverGlow: 'hover:shadow-[0_0_40px_-10px_rgba(155,92,246,0.3)]',
  },
  {
    id: 'brand',
    catKey: 'fc_catIdentity',
    titleKey: 'fc_brandTitle',
    descKey: 'fc_brandDesc',
    href: '/brand',
    icon: Palette,
    iconColor: 'text-teal-500',
    iconBg: 'bg-teal-500/10',
    iconRing: 'ring-teal-500/30',
    hoverGlow: 'hover:shadow-[0_0_40px_-10px_rgba(56,232,255,0.3)]',
  },
  {
    id: 'voice',
    catKey: 'fc_catVoice',
    titleKey: 'fc_voiceTitle',
    descKey: 'fc_voiceDesc',
    href: '/voices',
    icon: Mic2,
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-500/10',
    iconRing: 'ring-emerald-500/30',
    hoverGlow: 'hover:shadow-[0_0_40px_-10px_rgba(34,197,94,0.3)]',
  },
  {
    id: 'library',
    catKey: 'fc_catAssets',
    titleKey: 'fc_libraryTitle',
    descKey: 'fc_libraryDesc',
    href: '/projects',
    icon: ImageIcon,
    iconColor: 'text-amber-400',
    iconBg: 'bg-amber-500/10',
    iconRing: 'ring-amber-500/30',
    hoverGlow: 'hover:shadow-[0_0_40px_-10px_rgba(245,158,11,0.3)]',
  },
  {
    id: 'history',
    catKey: 'fc_catArchive',
    titleKey: 'fc_historyTitle',
    descKey: 'fc_historyDesc',
    href: '/history',
    icon: History,
    iconColor: 'text-pink-400',
    iconBg: 'bg-pink-500/10',
    iconRing: 'ring-pink-500/30',
    hoverGlow: 'hover:shadow-[0_0_40px_-10px_rgba(236,72,153,0.3)]',
  },
]

export function FeatureCards() {
  const { t } = useLanguage()
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {FEATURES.map((feature) => {
        const Icon = feature.icon
        return (
          <Link
            key={feature.id}
            href={feature.href}
            className={cn(
              'group card-interactive relative overflow-hidden rounded-2xl border border-border/60 bg-card p-6',
              feature.hoverGlow,
            )}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="relative space-y-4">
              <div className={cn(
                'inline-flex items-center justify-center w-11 h-11 rounded-xl ring-1 transition-transform duration-300 group-hover:scale-110',
                feature.iconBg,
                feature.iconRing,
              )}>
                <Icon size={20} className={feature.iconColor} />
              </div>

              <div>
                <p className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted] mb-1.5">
                  {t(feature.catKey)}
                </p>
                <h3 className="font-display text-xl text-foreground leading-tight">
                  {t(feature.titleKey)}
                </h3>
              </div>

              <p className="font-body text-sm text-[--text-secondary] leading-relaxed">
                {t(feature.descKey)}
              </p>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
