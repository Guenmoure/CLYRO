'use client'

import { useState, useMemo } from 'react'
import { Check, Sparkles, Search, X } from 'lucide-react'
import {
  CONTENT_TEMPLATES,
  type ContentTemplate,
  type ContentLang,
  type TemplateCategory,
  getNicheLabel,
  getStyleGradient,
  getStyleLabel,
  getTemplateCategory,
  tName,
  tDescription,
  tTags,
  tTone,
  tScript,
} from '@/lib/faceless-content-templates'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n'

// Same vocabulary as the Style gallery (see faceless-hub.tsx STYLE_TEMPLATES).
// Bilingual labels for the category filter pills surfaced above the niche row.
const CATEGORY_LABELS: Record<TemplateCategory, { en: string; fr: string }> = {
  all:        { en: 'All styles',  fr: 'Tous styles' },
  cinematic:  { en: 'Cinematic',   fr: 'Cinéma' },
  animation:  { en: 'Animation',   fr: 'Animation' },
  handmade:   { en: 'Handmade',    fr: 'Dessin main' },
  '3d':       { en: '3D',          fr: '3D' },
  typography: { en: 'Typography',  fr: 'Typographie' },
  retro:      { en: 'Retro',       fr: 'Rétro' },
}

interface ContentTemplateGalleryProps {
  selectedTemplateId?: string | null
  onSelect: (template: ContentTemplate) => void
  defaultLanguage?: ContentLang
}

const LANGUAGE_TABS: Array<{ id: ContentLang; label: string }> = [
  { id: 'fr', label: 'Français' },
  { id: 'en', label: 'English' },
]

export function ContentTemplateGallery({
  selectedTemplateId,
  onSelect,
  defaultLanguage = 'fr',
}: ContentTemplateGalleryProps) {
  // `lang` (FR/EN) controls the LANGUAGE of the templates shown (their copy
  // bodies). Interface chrome (headers, CTAs) follows the UI language via t().
  // Audit 16/06/26: previously the entire chrome was a French/English fork
  // gated on the template language picker, which leaked French into EN UI.
  const { t } = useLanguage()
  const [lang, setLang] = useState<ContentLang>(defaultLanguage)
  const [activeCategory, setActiveCategory] = useState<TemplateCategory>('all')
  const [activeNiche, setActiveNiche] = useState<string>('all')
  const [search, setSearch] = useState('')

  const copy = {
    eyebrow:            t('ctg_eyebrow'),
    title:              t('ctg_title'),
    intro:              t('ctg_intro'),
    searchPlaceholder:  t('ctg_searchPlaceholder'),
    allNiches:          t('ctg_allNiches'),
    categoryHeader:     t('ctg_categoryHeader'),
    nicheHeader:        t('ctg_nicheHeader'),
    noResults:          t('ctg_noResults'),
    scenes:             t('ctg_scenes'),
    selectedTag:        t('ctg_selectedTag'),
    selectCta:          t('ctg_selectCta'),
    clear:              t('ctg_clear'),
  }

  // Build category list — only show categories that have at least one template.
  // 'all' is always first; the rest are sorted by template count desc.
  const categories = useMemo<Array<{ id: TemplateCategory; label: string; count: number }>>(() => {
    const counts = new Map<TemplateCategory, number>()
    counts.set('all', CONTENT_TEMPLATES.length)
    for (const t of CONTENT_TEMPLATES) {
      const cat = getTemplateCategory(t)
      counts.set(cat, (counts.get(cat) ?? 0) + 1)
    }
    const populated = Array.from(counts.entries())
      .filter(([id]) => id !== 'all')
      .sort((a, b) => b[1] - a[1])
      .map(([id, count]) => ({ id, label: CATEGORY_LABELS[id][lang], count }))
    return [{ id: 'all' as TemplateCategory, label: CATEGORY_LABELS.all[lang], count: counts.get('all') ?? 0 }, ...populated]
  }, [lang])

  // Build niche list from data (sorted by template count desc).
  // When a visual category is active, recompute niche counts on the filtered
  // subset so the niche row reflects what's actually pickable.
  const niches = useMemo(() => {
    const subset = activeCategory === 'all'
      ? CONTENT_TEMPLATES
      : CONTENT_TEMPLATES.filter((t) => getTemplateCategory(t) === activeCategory)
    const counts = new Map<string, number>()
    for (const t of subset) {
      counts.set(t.niche, (counts.get(t.niche) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([niche, count]) => ({ ...getNicheLabel(niche, lang), count }))
  }, [lang, activeCategory])

  // Filter templates — combine category ∩ niche ∩ search (all AND).
  const filtered = useMemo(() => {
    let result = CONTENT_TEMPLATES
    if (activeCategory !== 'all') {
      result = result.filter((t) => getTemplateCategory(t) === activeCategory)
    }
    if (activeNiche !== 'all') {
      result = result.filter((t) => t.niche === activeNiche)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((t) =>
        tName(t, lang).toLowerCase().includes(q) ||
        tTags(t, lang).some((tag) => tag.toLowerCase().includes(q)) ||
        tTone(t, lang).some((kw) => kw.toLowerCase().includes(q)),
      )
    }
    return result
  }, [activeCategory, activeNiche, search, lang])

  return (
    <div className="border-t border-border px-4 sm:px-6 py-10 bg-muted/30">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={16} className="text-primary" />
              <p className="font-mono text-[10px] uppercase tracking-widest text-primary">
                {copy.eyebrow}
              </p>
            </div>
            <h3 className="font-display text-2xl font-bold text-foreground">
              {copy.title}
            </h3>
            <p className="font-body text-sm text-[--text-secondary] mt-1 max-w-xl">
              {copy.intro}
            </p>
          </div>

          {/* Language tabs — view language picker */}
          <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card p-1 shrink-0">
            {LANGUAGE_TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setLang(item.id)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-mono transition-all',
                  lang === item.id
                    ? 'bg-foreground text-background'
                    : 'text-[--text-muted] hover:text-foreground',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search + niche pills */}
        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[--text-muted]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={copy.searchPlaceholder}
              className="w-full pl-9 pr-9 py-2 rounded-xl bg-card border border-border text-sm font-body text-foreground placeholder:text-[--text-muted] focus:outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-ring/50 transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label={copy.clear}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[--text-muted] hover:text-foreground"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Visual category filter — same vocabulary as the Style gallery */}
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[--text-muted] mb-2">
              {copy.categoryHeader}
            </p>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setActiveCategory(cat.id)
                    // Reset niche when changing category so we don't end up
                    // with a niche that has zero templates in the new subset.
                    setActiveNiche('all')
                  }}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-body font-medium border transition-all',
                    activeCategory === cat.id
                      ? 'bg-brand/10 border-brand/50 text-primary'
                      : 'bg-card border-border text-[--text-muted] hover:border-border hover:text-foreground',
                  )}
                >
                  {cat.label}
                  <span className="font-mono text-[10px] opacity-60">{cat.count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Niche filter pills */}
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[--text-muted] mb-2">
              {copy.nicheHeader}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveNiche('all')}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-body font-medium border transition-all',
                  activeNiche === 'all'
                    ? 'bg-brand/10 border-brand/50 text-primary'
                    : 'bg-card border-border text-[--text-muted] hover:border-border hover:text-foreground',
                )}
              >
                {copy.allNiches}
              </button>
              {niches.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setActiveNiche(n.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-body font-medium border transition-all',
                    activeNiche === n.id
                      ? 'bg-brand/10 border-brand/50 text-primary'
                      : 'bg-card border-border text-[--text-muted] hover:border-border hover:text-foreground',
                  )}
                >
                  <span>{n.emoji}</span>
                  {n.label}
                  <span className="font-mono text-[10px] opacity-60">{n.count}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="font-body text-sm text-[--text-muted]">
              {copy.noResults}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                lang={lang}
                selected={selectedTemplateId === t.id}
                onSelect={() => onSelect(t)}
                selectedLabel={copy.selectedTag}
                ctaLabel={copy.selectCta}
                scenesLabel={copy.scenes}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Card ─────────────────────────────────────────────────────────────────────

function TemplateCard({
  template, lang, selected, onSelect,
  selectedLabel, ctaLabel, scenesLabel,
}: {
  template: ContentTemplate
  lang: ContentLang
  selected: boolean
  onSelect: () => void
  selectedLabel: string
  ctaLabel: string
  scenesLabel: string
}) {
  const niche = getNicheLabel(template.niche, lang)
  const gradient = getStyleGradient(template.fal_style)
  const styleLabel = getStyleLabel(template.fal_style, lang)

  const tone = tTone(template, lang)
  const tags = tTags(template, lang)

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'group relative text-left rounded-2xl border bg-card overflow-hidden',
        selected
          ? 'border-primary ring-2 ring-brand/30'
          : 'card-interactive border-border',
      )}
    >
      {/* Visual header — gradient based on style */}
      <div className={cn('relative h-24 bg-gradient-to-br', gradient)}>
        <div className="absolute inset-0 grid-bg opacity-[0.06]" />

        {/* Niche emoji */}
        <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/30 backdrop-blur-sm px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-white">
          <span>{niche.emoji}</span>
          {niche.label}
        </div>

        {/* Selection indicator */}
        {selected && (
          <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow">
            <Check size={12} className="text-white" />
          </div>
        )}

        {/* Bilingual badge */}
        {!selected && (
          <div className="absolute top-3 right-3 inline-flex items-center rounded-full bg-black/30 backdrop-blur-sm px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-white">
            EN · FR
          </div>
        )}

        {/* Style tag */}
        <div className="absolute bottom-3 right-3 inline-flex items-center rounded-md bg-black/40 backdrop-blur-sm px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider text-white/90">
          {styleLabel}
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        <div>
          <h4 className="font-display text-base font-bold text-foreground leading-tight">
            {tName(template, lang)}
          </h4>
          <p className="font-mono text-[10px] text-[--text-muted] mt-1">
            {template.recommended_scene_count} {scenesLabel} · {tone.slice(0, 3).join(' · ')}
          </p>
        </div>

        {/* Template pitch — the optimized description that tells the viewer what
            this template IS and when to pick it. Sits ABOVE the script preview
            so the editorial intent comes first, the example output second. */}
        <p className="font-body text-xs text-[--text-secondary] line-clamp-3 leading-snug">
          {tDescription(template, lang)}
        </p>

        {/* Script preview */}
        <p className="font-body text-xs text-[--text-muted]/80 line-clamp-2 italic">
          &ldquo;{tScript(template, lang)}&rdquo;
        </p>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="inline-block rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-mono text-[--text-muted]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Hover CTA hint */}
      <div className={cn(
        'absolute inset-x-0 bottom-0 px-4 py-2 bg-gradient-to-t from-brand/20 to-transparent transition-opacity duration-200',
        selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
      )}>
        <p className="font-mono text-[10px] uppercase tracking-wider text-primary text-center">
          {selected ? selectedLabel : ctaLabel}
        </p>
      </div>
    </button>
  )
}
