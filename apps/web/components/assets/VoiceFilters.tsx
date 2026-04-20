'use client'

import {
  Search, SlidersHorizontal, ArrowUpDown, X,
  MessageCircle, BookOpen, Users, Video,
  GraduationCap, Film, Radio,
} from 'lucide-react'
import { useState } from 'react'
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

// FR labels for the gender filter — the backend reports raw ElevenLabs values
// ("male", "female") which aren't user-friendly in a French UI.
const GENDER_LABELS: Record<string, string> = {
  male:   'Homme',
  female: 'Femme',
}

interface FilterOptionLanguage { value: string; label: string; flag: string }

interface VoiceFiltersProps {
  search:           string
  activeCategory:   string | null
  onSearch:         (q: string) => void
  onCategory:       (c: string | null) => void
  onSort?:          () => void

  /** ─── Optional advanced filters ──────────────────────────
   *  When `filterOptions` is provided, the component renders a collapsible
   *  row of dropdowns (Gender / Language / Use case). Hiding them behind a
   *  "Filtres" toggle keeps the default top bar clean for the 90% of users
   *  who only search/category-pill. The page hosts the state — this
   *  component is presentational.
   */
  filterOptions?:   {
    genders:   string[]
    languages: FilterOptionLanguage[]
    useCases:  string[]
  }
  gender?:          string
  language?:        string
  useCase?:         string
  onGender?:        (v: string) => void
  onLanguage?:      (v: string) => void
  onUseCase?:       (v: string) => void
}

export function VoiceFilters({
  search, activeCategory, onSearch, onCategory, onSort,
  filterOptions, gender, language, useCase, onGender, onLanguage, onUseCase,
}: VoiceFiltersProps) {
  const { t } = useLanguage()
  const [expanded, setExpanded] = useState(false)

  const hasAdvanced = Boolean(filterOptions)
  const activeCount = [gender, language, useCase].filter(Boolean).length

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
        {hasAdvanced ? (
          <Button
            variant={expanded || activeCount > 0 ? 'primary' : 'secondary'}
            size="sm"
            leftIcon={<SlidersHorizontal size={13} />}
            onClick={() => setExpanded((v) => !v)}
          >
            {t('filters')}{activeCount > 0 ? ` (${activeCount})` : ''}
          </Button>
        ) : (
          <Button variant="secondary" size="sm" leftIcon={<SlidersHorizontal size={13} />}>
            {t('filters')}
          </Button>
        )}
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

      {/* Advanced dropdowns — visible only when toggled open.
          Empty-string option doubles as "any", matching the backend
          expectation where an omitted filter returns all values. */}
      {hasAdvanced && expanded && filterOptions && (
        <div className="flex flex-wrap gap-2 pt-1">
          <select
            value={gender ?? ''}
            onChange={(e) => onGender?.(e.target.value)}
            className="bg-muted border border-border rounded-lg h-9 px-3 font-body text-xs text-foreground focus:outline-none focus:border-blue-500/60"
          >
            <option value="">Genre</option>
            {filterOptions.genders.map((g) => (
              <option key={g} value={g}>{GENDER_LABELS[g] ?? g}</option>
            ))}
          </select>
          <select
            value={language ?? ''}
            onChange={(e) => onLanguage?.(e.target.value)}
            className="bg-muted border border-border rounded-lg h-9 px-3 font-body text-xs text-foreground focus:outline-none focus:border-blue-500/60"
          >
            <option value="">Langue</option>
            {filterOptions.languages.map((l) => (
              <option key={l.value} value={l.value}>{l.flag} {l.label}</option>
            ))}
          </select>
          <select
            value={useCase ?? ''}
            onChange={(e) => onUseCase?.(e.target.value)}
            className="bg-muted border border-border rounded-lg h-9 px-3 font-body text-xs text-foreground focus:outline-none focus:border-blue-500/60"
          >
            <option value="">Usage</option>
            {filterOptions.useCases.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>

          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => { onGender?.(''); onLanguage?.(''); onUseCase?.('') }}
              className="inline-flex items-center gap-1 text-xs text-[--text-muted] hover:text-foreground transition-colors px-2"
            >
              <X size={12} /> Réinitialiser
            </button>
          )}
        </div>
      )}
    </div>
  )
}
