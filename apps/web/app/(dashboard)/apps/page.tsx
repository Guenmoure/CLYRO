'use client'

import Link from 'next/link'
import { Video, Sparkles, Rocket, ArrowRight, LayoutGrid } from 'lucide-react'
import { useLanguage } from '@/lib/i18n'
import { cn } from '@/lib/utils'

// Audit 16/06/26 — per-card badge + cost hint so users can pick a module
// with realistic expectations. `badgeKey` maps to apps_badge_* in translations.
// `costCredits` shows a rough "credits per video" hint (≈ shortest job).
// `soon: true` flags modules that should NOT navigate yet.
interface AppsModule {
  titleKey:     string
  descKey:      string
  href:         string
  icon:         typeof Video
  gradient:     string
  iconColor:    string
  badgeKey?:    'apps_badge_new' | 'apps_badge_beta' | 'apps_badge_soon'
  costCredits?: number
  soon?:        boolean
}

const MODULES: readonly AppsModule[] = [
  {
    titleKey: 'npd_faceless_title',
    descKey:  'npd_faceless_desc',
    href:     '/faceless',
    icon:     Video,
    gradient: 'from-feature-faceless/20 to-feature-faceless/5',
    iconColor: 'text-feature-faceless',
    costCredits: 10,
  },
  {
    titleKey: 'npd_motion_title',
    descKey:  'npd_motion_desc',
    href:     '/motion',
    icon:     Sparkles,
    gradient: 'from-violet-500/20 to-violet-500/5',
    iconColor: 'text-violet-500',
    badgeKey: 'apps_badge_beta',
    costCredits: 30,
  },
  {
    titleKey: 'npd_autopilot_title',
    descKey:  'npd_autopilot_desc',
    href:     '/autopilot',
    icon:     Rocket,
    gradient: 'from-amber-500/20 to-amber-500/5',
    iconColor: 'text-amber-500',
    badgeKey: 'apps_badge_soon',
    soon:     true,
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
            // Audit 16/06/26 — modules flagged `soon: true` render as a
            // disabled card (no navigation) so the « Bientôt » badge isn't
            // misleading.
            const Wrapper = mod.soon ? 'div' : Link
            const wrapperProps = mod.soon
              ? { className: '' }
              : { href: mod.href }
            return (
              <Wrapper
                key={mod.href}
                {...wrapperProps as { href: string; className?: string }}
                className={cn(
                  'group rounded-2xl border border-border bg-card overflow-hidden',
                  'transition-all duration-200',
                  mod.soon
                    ? 'opacity-70 cursor-not-allowed'
                    : 'hover:border-brand/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                )}
                aria-disabled={mod.soon ? true : undefined}
              >
                <div className={cn('relative aspect-[16/9] bg-gradient-to-br flex items-center justify-center', mod.gradient)}>
                  <div className="w-14 h-14 rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <Icon size={24} className={mod.iconColor} />
                  </div>
                  {/* Badge — top-right of the visual block. */}
                  {mod.badgeKey && (
                    <span
                      className={cn(
                        'absolute top-3 right-3 inline-flex items-center px-2 py-0.5 rounded-full',
                        'font-mono text-[10px] uppercase tracking-widest',
                        mod.badgeKey === 'apps_badge_beta'  && 'bg-violet-500/10 text-violet-600 border border-violet-500/20',
                        mod.badgeKey === 'apps_badge_new'   && 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20',
                        mod.badgeKey === 'apps_badge_soon'  && 'bg-muted text-[--text-muted] border border-border',
                      )}
                    >
                      {t(mod.badgeKey)}
                    </span>
                  )}
                </div>
                <div className="p-4 space-y-2">
                  <h2 className="font-display text-base font-semibold text-foreground">
                    {t(mod.titleKey)}
                  </h2>
                  <p className="font-body text-sm text-[--text-secondary] leading-relaxed">
                    {t(mod.descKey)}
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="inline-flex items-center gap-1 font-body text-xs font-medium text-primary group-hover:gap-2 transition-all">
                      {mod.soon ? t('apps_badge_soon') : t('apps_open')}
                      {!mod.soon && <ArrowRight size={12} />}
                    </span>
                    {/* Cost hint */}
                    {mod.costCredits !== undefined && (
                      <span className="font-mono text-[10px] text-[--text-muted]">
                        {t('apps_costHint').replace('{n}', String(mod.costCredits))}
                      </span>
                    )}
                  </div>
                </div>
              </Wrapper>
            )
          })}
        </div>
      </div>
    </div>
  )
}
