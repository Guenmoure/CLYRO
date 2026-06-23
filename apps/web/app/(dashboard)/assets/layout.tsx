'use client'

/**
 * Assets layout — editorial header + ed-tabs (Avatars / Voices).
 * Templates lives on its own /templates route.
 *
 * Vague 2 — 23/06/26 :
 *   • PageHeader : eyebrow « Library » + folio + h-display + lead + rule
 *   • Tabs : mono uppercase underline (ed-tabs)
 *   • Inner pages don't re-render the title — they just render their content.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLanguage } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export default function AssetsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { t } = useLanguage()

  const TABS = [
    { href: '/assets/avatars', label: t('avatarsLabel') },
    { href: '/assets/voices',  label: t('voices')       },
  ]

  return (
    <div className="flex flex-col min-h-full bg-background">
      {/* ── Editorial page header ───────────────────────────── */}
      <div className="px-4 sm:px-6 lg:px-12 pt-12 pb-0 max-w-6xl mx-auto w-full">
        <div className="divider-with-num">
          <span className="eyebrow">{t('nav_sec_library')}</span>
          <hr />
          <span className="folio">№ 06 / 12</span>
        </div>
        <h1 className="h-display">{t('assets')}</h1>
        <p className="lead mt-5">{t('assets_subtitle')}</p>
        <hr className="rule-thin mt-8" />

        {/* ── Editorial tabs ────────────────────────────────── */}
        <div className="ed-tabs mt-6" role="tablist">
          {TABS.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                role="tab"
                aria-selected={active}
                className={cn('ed-tab', active && 'active')}
              >
                {label}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Page content */}
      <div className="flex-1 px-4 sm:px-6 lg:px-12 pb-12 max-w-6xl mx-auto w-full">
        {children}
      </div>
    </div>
  )
}
