'use client'

/**
 * ContextPanel — contextual sub-menu shown to the right of the icon rail
 * (HeyGen pattern).
 *
 * Renders the active rail entry's section title, an optional full-width
 * "+ Create new" button (for creation modules → routes to <href>/new), then
 * its child links, optionally grouped under uppercase gray headings.
 *
 * The panel is plain navigation (no focus trap): it does not steal focus and
 * does not block Tab from reaching the rail or main content.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n'
import { resolveActiveChildHref, type NavEntry } from './nav-model'

interface ContextPanelProps {
  entry: NavEntry
}

export function ContextPanel({ entry }: ContextPanelProps) {
  const { t }    = useLanguage()
  const pathname = usePathname()
  const children = entry.children ?? []
  const activeChildHref = resolveActiveChildHref(entry, pathname)

  // Group children by groupKey, preserving declaration order. `undefined`
  // groupKey = an ungrouped block at the top (e.g. "Quick create").
  const blocks: { groupKey?: string; items: typeof children }[] = []
  for (const child of children) {
    const last = blocks[blocks.length - 1]
    if (last && last.groupKey === child.groupKey) {
      last.items.push(child)
    } else {
      blocks.push({ groupKey: child.groupKey, items: [child] })
    }
  }

  return (
    <div className="flex flex-col h-full px-3 py-4">
      {/* Section title */}
      <p className="px-2 mb-3 font-display text-sm font-semibold text-foreground truncate">
        {t(entry.labelKey)}
      </p>

      {/* "+ Create new" — creation modules only */}
      {entry.isModule && (
        <Link
          href={`${entry.href}/new`}
          className={cn(
            'flex items-center justify-center gap-1.5 h-9 mb-3 rounded-lg',
            'bg-primary text-primary-foreground text-sm font-medium font-display',
            'hover:opacity-90 transition-opacity',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
          )}
        >
          <Plus size={15} strokeWidth={2} aria-hidden="true" />
          {t('nav_createNew')}
        </Link>
      )}

      {/* Sub-links, grouped */}
      <nav aria-label={t(entry.labelKey)} className="flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-3">
        {blocks.map((block, i) => (
          <div key={block.groupKey ?? `blk-${i}`} className="space-y-0.5">
            {block.groupKey && (
              <p className="px-2 pt-1 pb-1 text-[10px] font-mono font-medium uppercase tracking-widest text-[--text-muted]">
                {t(block.groupKey)}
              </p>
            )}
            {block.items.map((child) => {
              const active = child.href === activeChildHref
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center h-9 px-2 rounded-lg text-sm font-body transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                    active
                      ? 'bg-accent text-accent-foreground font-medium'
                      : 'text-[--text-secondary] hover:bg-muted hover:text-foreground',
                  )}
                >
                  {t(child.labelKey)}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>
    </div>
  )
}
