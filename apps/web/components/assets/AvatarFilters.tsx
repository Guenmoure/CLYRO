'use client'

import { Search, SlidersHorizontal } from 'lucide-react'
import { useLanguage } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export type AvatarFilter = 'all' | 'professional' | 'lifestyle' | 'ugc' | 'community' | 'favorites'

const FILTER_KEYS: { key: AvatarFilter; translationKey: string }[] = [
  { key: 'all',          translationKey: 'all' },
  { key: 'professional', translationKey: 'professional' },
  { key: 'lifestyle',    translationKey: 'lifestyle' },
  { key: 'ugc',          translationKey: 'ugc' },
  { key: 'community',    translationKey: 'community' },
  { key: 'favorites',    translationKey: 'favorites' },
]

interface AvatarFiltersProps {
  search:         string
  activeFilter:   AvatarFilter
  onSearch:       (q: string) => void
  onFilter:       (f: AvatarFilter) => void
}

export function AvatarFilters({ search, activeFilter, onSearch, onFilter }: AvatarFiltersProps) {
  const { t } = useLanguage()

  return (
    <div className="px-6 py-4 space-y-3 border-b border-border/30">
      {/* Search bar */}
      <div className="relative">
        <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[--text-muted] pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={t('searchAvatars')}
          className="w-full bg-muted border border-border rounded-xl h-11 pl-10 pr-10 font-body text-sm text-foreground placeholder:text-[--text-muted] focus:outline-none focus:border-blue-500/60 transition-colors"
        />
        <button
          type="button"
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-border hover:bg-muted transition-colors"
          aria-label={t('filters')}
        >
          <SlidersHorizontal size={13} className="text-[--text-secondary]" />
        </button>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {FILTER_KEYS.map(({ key, translationKey }) => (
          <button
            key={key}
            type="button"
            onClick={() => onFilter(key)}
            className={cn(
              'px-4 py-1.5 rounded-full font-body text-sm border transition-all duration-150',
              activeFilter === key
                ? 'bg-blue-500/15 border-blue-500/40 text-blue-400'
                : 'bg-muted border-border text-[--text-secondary] hover:border-border hover:text-foreground',
            )}
          >
            {t(translationKey)}
          </button>
        ))}
      </div>
    </div>
  )
}
