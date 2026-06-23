'use client'

/**
 * Apps — catalogue of every creative app in the CLYRO suite.
 *
 * Vague 2 — 23/06/26 — editorial layout :
 *   • PageHeader : eyebrow « Create » + folio + h-display + lead + rule
 *   • 5-item grid (Anim, Avatar Studio, Motion, Brand, Autopilot)
 *   • Each tile : striped placeholder + folio + tag + h-card + lead
 *
 * Audit fixes carried over :
 *   • Apps that aren't shipped yet (`soon: true`) render as disabled
 *     cards (no Link) so the « SOON » tag isn't misleading.
 *   • Cost hint per card (« ~10 credits / video ») for predictability.
 */

import Link from 'next/link'
import { useLanguage } from '@/lib/i18n'
import { cn } from '@/lib/utils'

interface AppsModule {
  id:           string
  folio:        string
  titleKey:     string
  descKey:      string
  href:         string
  tagKey:       string
  badgeKey?:    'apps_badge_new' | 'apps_badge_beta' | 'apps_badge_soon'
  costCredits?: number
  soon?:        boolean
}

const MODULES: readonly AppsModule[] = [
  {
    id: 'anim',
    folio: 'APP.01',
    titleKey: 'nav_animVideo',
    descKey:  'npd_faceless_desc',
    href:     '/faceless',
    tagKey:   'apps_tag_motion',
    costCredits: 10,
  },
  {
    id: 'studio',
    folio: 'APP.02',
    titleKey: 'nav_avatarStudio',
    descKey:  'apps_studio_desc',
    href:     '/studio',
    tagKey:   'apps_tag_avatar',
    costCredits: 15,
  },
  {
    id: 'motion',
    folio: 'APP.03',
    titleKey: 'npd_motion_title',
    descKey:  'npd_motion_desc',
    href:     '/motion',
    tagKey:   'apps_tag_motion',
    badgeKey: 'apps_badge_beta',
    costCredits: 30,
  },
  {
    id: 'brand',
    folio: 'APP.04',
    titleKey: 'nav_brand',
    descKey:  'apps_brand_desc',
    href:     '/brand',
    tagKey:   'apps_tag_brand',
  },
  {
    id: 'autopilot',
    folio: 'APP.05',
    titleKey: 'npd_autopilot_title',
    descKey:  'npd_autopilot_desc',
    href:     '/autopilot',
    tagKey:   'apps_tag_schedule',
    badgeKey: 'apps_badge_soon',
    soon:     true,
  },
] as const

export default function AppsHubPage() {
  const { t } = useLanguage()

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="px-4 sm:px-6 lg:px-12 py-12 max-w-6xl mx-auto">

        {/* ── Editorial page header ───────────────────────────── */}
        <header className="mb-10">
          <div className="divider-with-num">
            <span className="eyebrow">{t('nav_sec_create')}</span>
            <hr />
            <span className="folio">№ 03 / 12</span>
          </div>
          <h1 className="h-display">{t('apps_hubHeading')}</h1>
          <p className="lead mt-5">{t('apps_hubDesc')}</p>
          <hr className="rule-thin mt-8" />
        </header>

        {/* ── Grid of app tiles ────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {MODULES.map((mod) => {
            // Soon → div (no nav), else → Link
            const Wrapper = mod.soon ? 'div' : Link
            const wrapperProps = mod.soon
              ? { className: 'tile opacity-70 cursor-not-allowed' }
              : { href: mod.href, className: 'tile block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50' }

            return (
              <Wrapper
                key={mod.id}
                {...wrapperProps as { href: string; className?: string }}
                aria-disabled={mod.soon ? true : undefined}
              >
                {/* Striped placeholder with folio + tag */}
                <div className="ph" style={{ aspectRatio: '16 / 11' }}>
                  <div className="ph-folio">{mod.folio}</div>
                  <span className="ph-label">{t(mod.tagKey)}</span>
                  {mod.badgeKey && (
                    <span
                      className={cn(
                        'absolute top-2 right-2 font-mono uppercase tracking-[0.14em]',
                        'px-2 py-0.5 rounded-full border bg-card',
                        mod.badgeKey === 'apps_badge_beta'
                          ? 'border-primary/30 text-primary'
                          : mod.badgeKey === 'apps_badge_new'
                            ? 'border-success/30 text-success'
                            : 'border-border text-[--text-muted]',
                      )}
                      style={{ fontSize: 9 }}
                    >
                      {t(mod.badgeKey)}
                    </span>
                  )}
                </div>
                <div className="tile-body">
                  <div className="folio mb-2">{t(mod.tagKey)}</div>
                  <h2 className="h-card">{t(mod.titleKey)}</h2>
                  <p className="font-body text-sm text-[--text-secondary] leading-relaxed mt-2 min-h-[3em]">
                    {t(mod.descKey)}
                  </p>
                  <div className="flex items-baseline justify-between mt-4 pt-3 border-t border-border/60">
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-foreground">
                      {mod.soon ? t('apps_badge_soon') : t('apps_open') + ' →'}
                    </span>
                    {mod.costCredits !== undefined && (
                      <span className="folio">
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
