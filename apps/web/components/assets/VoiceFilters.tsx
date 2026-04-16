'use client'

import { Search, SlidersHorizontal, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const VOICE_CATEGORIES = [
  'Conversationnel', 'Narration', 'Personnages',
  'Réseaux sociaux', 'Éducatif', 'Cinématique',
  'Newscast', 'Sports', 'Podcast', 'YouTube',
]

interface VoiceFiltersProps {
  search:        string
  activeCategory: string | null
  onSearch:      (q: string) => void
  onCategory:    (c: string | null) => void
  onSort?:       () => void
}

export function VoiceFilters({ search, activeCategory, onSearch, onCategory, onSort }: VoiceFiltersProps) {
  return (
    <div className="px-6 py-4 space-y-3 border-b border-border/30">
      {/* Search + action row */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[--text-muted] pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Rechercher dans les voix..."
            className="w-full bg-muted border border-border rounded-xl h-10 pl-9 pr-4 font-body text-sm text-foreground placeholder:text-[--text-muted] focus:outline-none focus:border-blue-500/60 transition-colors"
          />
        </div>
        <Button variant="secondary" size="sm" leftIcon={<SlidersHorizontal size={13} />}>
          Filtres
        </Button>
        {onSort && (
          <button
            type="button"
            onClick={onSort}
            className="p-2 rounded-xl bg-muted border border-border hover:bg-border transition-colors"
            aria-label="Trier"
          >
            <ArrowUpDown size={14} className="text-[--text-secondary]" />
          </button>
        )}
      </div>

      {/* Category pills — horizontally scrollable */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {VOICE_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => onCategory(activeCategory === cat ? null : cat)}
            className={cn(
              'shrink-0 px-3 py-1.5 rounded-full font-body text-xs border transition-all duration-150 whitespace-nowrap',
              activeCategory === cat
                ? 'bg-blue-500/15 border-blue-500/40 text-blue-400'
                : 'bg-muted border-border text-[--text-secondary] hover:border-border hover:text-foreground',
            )}
          >
            {cat}
          </button>
        ))}
      </div>
    </div>
  )
}
