'use client'

import {
  Search, SlidersHorizontal, ArrowUpDown,
  MessageCircle, BookOpen, Users, Video,
  GraduationCap, Film, Radio,
} from 'lucide-react'
import { useLanguage } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const VOICE_CATEGORIES = [
  { key: 'conversational', translationKey: 'conversational', icon: MessageCircle },
  { key: 'narration',      translationKey: 'narration',      icon: BookOpen },
  { key: 'characters',     translationKey: 'characters',     icon: Users },
  { key: 'social media',   translationKey: 'socialMedia',    icon: Video },
  { key: 'educational',    translationKey: 'educational',    icon: GraduationCap },
  { key: 'news',           translationKey: 'news',           icon: Radio },
  { key: 'video games',    translationKey: 'characters',     icon: Film },
]

interface VoiceFiltersProps {
  search:        string
  activeCategory: string | null
  onSearch:      (q: string) => void
  onCategory:    (c: string | null) => void
  onSort?:       () => void
}

export function VoiceFilters({ search, activeCategory, onSearch, onCategory, onSort }: VoiceFiltersProps) {
  const { t } = useLanguage()

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
            placeholder={t('searchVoices')}
            className="w-full bg-muted border border-border rounded-xl h-10 pl-9 pr-4 font-body text-sm text-foreground placeholder:text-[--text-muted] focus:outline-none focus:border-blue-500/60 transition-colors"
          />
        </div>
        <Button variant="secondary" size="sm" leftIcon={<SlidersHorizontal size={13} />}>
          {t('filters')}
        </Button>
        {onSort && (
          <button
            type="button"
            onClick={onSort}
            className="p-2 rounded-xl bg-muted border border-border hover:bg-border transition-colors"
            aria-label="Sort"
          >
            <ArrowUpDown size={14} className="text-[--text-secondary]" />
          </button>
        )}
      </div>

      {/* Category pills — horizontally scrollable */}
      <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
        {VOICE_CATEGORIES.map(({ key, translationKey, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => onCategory(activeCategory === key ? null : key)}
            className={cn(
              'shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-body text-xs font-medium border transition-all duration-150 whitespace-nowrap',
              activeCategory === key
                ? 'bg-foreground text-background border-foreground'
                : 'bg-card text-foreground border-border hover:border-blue-500/40',
            )}
          >
            <Icon size={12} />
            {t(translationKey)}
          </button>
        ))}
      </div>
    </div>
  )
}
