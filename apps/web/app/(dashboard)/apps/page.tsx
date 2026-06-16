'use client'

import Link from 'next/link'
import { Video, Sparkles, Rocket, ArrowRight, LayoutGrid } from 'lucide-react'
import { useLanguage } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const MODULES = [
  {
    titleKey: 'npd_faceless_title',
    descKey:  'npd_faceless_desc',
    href:     '/faceless',
    icon:     Video,
    gradient: 'from-feature-faceless/20 to-feature-faceless/5',
    iconColor: 'text-feature-faceless',
  },
  {
    titleKey: 'npd_motion_title',
    descKey:  'npd_motion_desc',
    href:     '/motion',
    icon:     Sparkles,
    gradient: 'from-violet-500/20 to-violet-500/5',
    iconColor: 'text-violet-500',
  },
  {
    titleKey: 'npd_autopilot_title',
    descKey:  'npd_autopilot_desc',
    href:     '/autopilot',
    icon:     Rocket,
    gradient: 'from-amber-500/20 to-amber-500/5',
    iconColor: 'text-amber-500',
  },
] as const

export default function AppsHubPage() {
  const { t } = useLanguage()

  return (
    <div className="flex-1 overflow-y-auto bg-background px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <LayoutGrid size={14} className="text-primary" />
            <p className="font-mono text-[11px] uppercase tracking-widest text-[--text-secondary] font-semibold">
              {t('nav_apps')}
            </p>
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground">
            {t('apps_hubHeading')}
          </h1>
          <p className="font-body text-sm text-[--text-secondary] mt-1 max-w-xl">
            {t('apps_hubDesc')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MODULES.map((mod) => {
            const Icon = mod.icon
            return (
              <Link
                key={mod.href}
                href={mod.href}
                className={cn(
                  'group rounded-2xl border border-border bg-card overflow-hidden',
                  'transition-all duration-200 hover:border-brand/30 hover:shadow-md',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                )}
              >
                <div className={cn('aspect-[16/9] bg-gradient-to-br flex items-center justify-center', mod.gradient)}>
                  <div className="w-14 h-14 rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <Icon size={24} className={mod.iconColor} />
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  <h2 className="font-display text-base font-semibold text-foreground">
                    {t(mod.titleKey)}
                  </h2>
                  <p className="font-body text-sm text-[--text-secondary] leading-relaxed">
                    {t(mod.descKey)}
                  </p>
                  <span className="inline-flex items-center gap-1 font-body text-xs font-medium text-primary group-hover:gap-2 transition-all">
                    {t('apps_open')}
                    <ArrowRight size={12} />
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
