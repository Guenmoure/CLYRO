'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Dna, Package, ImageIcon, Megaphone, Camera, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n'

interface BrandSidebarProps {
  kitId: string
}

/**
 * Sidebar verticale à icônes pour le module Brand Kit, style Pomelli.
 * Hover affiche le label en tooltip à droite. L'icône active est marquée
 * par un trait vertical terracotta accent à gauche.
 *
 * Routes pointées (certaines pages n'existent pas encore en Phase 1, elles
 * sont placeholder pour annoncer la roadmap Phases 2-5).
 */
export function BrandSidebar({ kitId }: BrandSidebarProps) {
  const pathname = usePathname() ?? ''
  const { t } = useLanguage()

  const items = [
    { label: t('bk_navDna'),        href: `/brand/${kitId}/dna`,        Icon: Dna,        enabled: true  },
    { label: t('bk_navCatalog'),    href: `/brand/${kitId}/catalog`,    Icon: Package,    enabled: true  },
    { label: t('bk_navAssets'),     href: `/brand/${kitId}/assets`,     Icon: ImageIcon,  enabled: true  },
    { label: t('bk_navCampaigns'),  href: `/brand/${kitId}/campaigns`,  Icon: Megaphone,  enabled: true  },
    { label: t('bk_navPhotoshoot'), href: `/brand/${kitId}/photoshoot`, Icon: Camera,     enabled: true  },
    { label: t('bk_navBook'),       href: `/brand/${kitId}/book`,       Icon: BookOpen,   enabled: true  },
  ]

  return (
    <aside className="shrink-0 w-[70px] border-r border-border bg-background flex flex-col items-center py-6 gap-1">
      {items.map(({ label, href, Icon, enabled }) => {
        const active = pathname.startsWith(href)
        const content = (
          <div className="group relative flex items-center justify-center w-12 h-12 rounded-xl">
            {active && (
              <span
                className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-[#c45b3a]"
                aria-hidden="true"
              />
            )}
            <Icon
              size={22}
              className={cn(
                'transition-colors',
                active ? 'text-foreground' : 'text-[--text-muted] group-hover:text-foreground',
                !enabled && 'opacity-40',
              )}
            />
            {/* Hover label */}
            <span
              className="absolute left-full ml-3 px-2.5 py-1 rounded-md bg-foreground text-background font-mono text-[11px] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10"
              aria-hidden="true"
            >
              {label}
              {!enabled && <span className="ml-1 opacity-60">(soon)</span>}
            </span>
          </div>
        )

        return enabled ? (
          <Link key={label} href={href} aria-label={label}>
            {content}
          </Link>
        ) : (
          <div key={label} role="presentation" aria-label={`${label} (coming soon)`} className="cursor-not-allowed">
            {content}
          </div>
        )
      })}
    </aside>
  )
}
