'use client'

import { usePathname } from 'next/navigation'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { NotificationPanel } from '@/components/shared/notification-panel'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':         'Dashboard',
  '/faceless':          'Vidéo Faceless',
  '/faceless/new':      'Nouvelle vidéo',
  '/motion':            'Motion Design',
  '/motion/new':        'Nouveau motion',
  '/brand':             'Brand Kit',
  '/brand/new':         'Nouvelle identité',
  '/projects':          'Bibliothèque',
  '/history':           'Historique',
  '/voices':            'Mes voix',
  '/settings':          'Paramètres',
  '/settings/brand':    'Brand Kits',
  '/settings/billing':  'Facturation',
}

export function Header() {
  const pathname = usePathname()
  const title = PAGE_TITLES[pathname] ?? null

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
