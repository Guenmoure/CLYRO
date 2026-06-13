'use client'

/**
 * NavRail — narrow icon rail (HeyGen pattern).
 *
 * Vertical stack of icon + micro-label entries. Active entry = violet icon
 * over a pale accent background. The user avatar / credits live in the parent
 * Sidebar, below the rail.
 *
 * Selecting an entry navigates to its href AND (via onSelect) tells the parent
 * which contextual panel to show.
 */

import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n'
import type { NavEntry } from './nav-model'

interface NavRailProps {
  items:      NavEntry[]
  activeId?:  string
  onSelect:   (entry: NavEntry) => void
}

export function NavRail({ items, activeId, onSelect }: NavRailProps) {
  const { t } = useLanguage()

  return (
    <nav aria-label={t('nav_primary')} className="flex flex-col gap-1 px-2">
      {items.map((entry) => {
        const Icon   = entry.icon
        const active = entry.id === activeId
        return (
          <button
            key={entry.id}
            type="button"
            onClick={() => onSelect(entry)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'group w-full flex flex-col items-center gap-1 rounded-xl py-2 px-1',
              'transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              active
                ? 'bg-accent text-accent-foreground'
                : 'text-[--text-muted] hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon
              size={20}
              strokeWidth={1.8}
              className={cn(
                'shrink-0 transition-colors',
                active ? 'text-accent-foreground' : 'text-[--text-muted] group-hover:text-foreground',
              )}
              aria-hidden="true"
            />
            <span className={cn(
              'text-[11px] leading-none font-body text-center truncate max-w-full',
              active ? 'font-medium' : '',
            )}>
              {t(entry.labelKey)}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
