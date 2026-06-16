'use client'

import { usePathname } from 'next/navigation'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { NotificationPanel } from '@/components/shared/notification-panel'
import { useLanguage } from '@/lib/i18n'

const PAGE_TITLE_KEYS: Record<string, string> = {
  '/dashboard':         'hd_dashboard',
  '/faceless':          'hd_faceless',
  '/faceless/new':      'hd_facelessNew',
  '/motion':            'hd_motion',
  '/motion/new':        'hd_motionNew',
  '/brand':             'hd_brand',
  '/brand/new':         'hd_brandNew',
  '/projects':          'hd_projects',
  '/history':           'hd_history',
  '/voices':            'hd_voices',
  '/settings':          'hd_settings',
  '/settings/brand':    'hd_settingsBrand',
  '/settings/billing':  'hd_settingsBilling',
}

export function Header() {
  const pathname = usePathname()
  const { t } = useLanguage()
  const key = PAGE_TITLE_KEYS[pathname]
  const title = key ? t(key as Parameters<typeof t>[0]) : null

  return (
    <header className="h-14 flex items-center justify-between px-6 gap-2 shrink-0 relative z-10 border-b border-border/40">
      {/* Page title */}
      <div className="flex items-center gap-2">
        {title && (
          <h1 className="font-display text-base font-semibold text-foreground">
            {title}
          </h1>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <NotificationPanel />
      </div>
    </header>
  )
}
