'use client'

import { useState, useMemo } from 'react'
import { Check, Sparkles, Search, X } from 'lucide-react'
import {
  CONTENT_TEMPLATES,
  type ContentTemplate,
  getNicheLabel,
  getStyleGradient,
} from '@/lib/faceless-content-templates'
import { cn } from '@/lib/utils'

interface ContentTemplateGalleryProps {
  selectedTemplateId?: string | null
  onSelect: (template: ContentTemplate) => void
  defaultLanguage?: 'en' | 'fr'
}

const LANGUAGE_FILTER: Array<{ id: 'all' | 'fr' | 'en'; label: string }> = [
  { id: 'all', label: 'Toutes' },
  { id: 'fr',  label: 'Français' },
  { id: 'en',  label: 'English' },
]

export function ContentTemplateGallery({
  selectedTemplateId,
  onSelect,
  defaultLanguage = 'fr',
}: ContentTemplateGalleryProps) {
  const [language, setLanguage] = useState<'all' | 'fr' | 'en'>(defaultLanguage)
  const [activeNiche, setActiveNiche] = useState<string>('all')
  const [search, setSearch] = useState('')

  // Build niche list from data (sorted by template count desc)
  const niches = useMemo(() => {
    const counts = new Map<string, number>()
    for (const t of CONTENT_TEMPLATES) {
      counts.set(t.niche, (counts.get(t.niche) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([niche, count]) => ({ ...getNicheLabel(niche), count }))
  }, [])

  // Filter templates
  const filtered = useMemo(() => {
    let result = CONTENT_TEMPLATES
    if (language !== 'all') {
      result = result.filter((t) => t.language === language)
    }
    if (activeNiche !== 'all') {
      result = result.filter((t) => t.niche === activeNiche)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((t) =>
        t.name.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q)) ||
        t.tone_keywords.some((kw) => kw.toLowerCase().includes(q))
      )
    }
    return result
  }, [language, activeNiche, search])

  return (
    <div className="border-t border-border px-6 py-10 bg-muted/30">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={16} className="text-blue-500" />
              <p className="font-mono text-[10px] uppercase tracking-widest text-blue-500">
                Démarrage rapide
              </p>
            </div>
            <h3 className="font-display text-2xl font-bold text-foreground">
              Choisis un template inspiré
            </h3>
            <p className="font-body text-sm text-[--text-secondary] mt-1 max-w-xl">
              {CONTENT_TEMPLATES.length} formats prêts à l&apos;emploi, copiés des meilleures chaînes YouTube faceless.
              Sélection → description, style et structure pré-remplis.
            </p>
          </div>

          {/* Language tabs */}
          <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card p-1 shrink-0">
            {LANGUAGE_FILTER.map((lang) => (
              <button
                key={lang.id}
                type="button"
                onClick={() => setLanguage(lang.id)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-mono transition-all',
                  language === lang.id
                    ? 'bg-foreground text-background'
                    : 'text-[--text-muted] hover:text-foreground',
                )}
              >
                {lang.label}
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
              placeholder="Cherche un template, un tag, une niche…"
              className="w-full pl-9 pr-9 py-2 rounded-xl bg-card border border-border text-sm font-body text-foreground placeholder:text-[--text-muted] focus:outline-none focus:border-blue-500/50 transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Effacer"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[--text-muted] hover:text-foreground"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Niche filter pills */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveNiche('all')}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-body font-medium border transition-all',
                activeNiche === 'all'
                  ? 'bg-blue-500/10 border-blue-500/50 text-blue-500'
                  : 'bg-card border-border text-[--text-muted] hover:border-border hover:text-foreground',
              )}
            >
              Toutes les niches
            </button>
            {niches.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => setActiveNiche(n.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-body font-medium border transition-all',
                  activeNiche === n.id
                    ? 'bg-blue-500/10 border-blue-500/50 text-blue-500'
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

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="font-body text-sm text-[--text-muted]">
              Aucun template ne correspond à ces critères.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                selected={selectedTemplateId === t.id}
                onSelect={() => onSelect(t)}
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
  template, selected, onSelect,
}: {
  template: ContentTemplate
  selected: boolean
  onSelect: () => void
}) {
  const niche = getNicheLabel(template.niche)
  const gradient = getStyleGradient(template.fal_style)

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'group relative text-left rounded-2xl border bg-card overflow-hidden',
        selected
          ? 'border-blue-500 ring-2 ring-blue-500/30'
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
          <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center shadow">
            <Check size={12} className="text-white" />
          </div>
        )}

        {/* Lang badge */}
        {!selected && (
          <div className="absolute top-3 right-3 inline-flex items-center rounded-full bg-black/30 backdrop-blur-sm px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-white">
            {template.language}
          </div>
        )}

        {/* Style tag */}
        <div className="absolute bottom-3 right-3 inline-flex items-center rounded-md bg-black/40 backdrop-blur-sm px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider text-white/90">
          {template.fal_style}
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        <div>
          <h4 className="font-display text-base font-bold text-foreground leading-tight">
            {template.name}
          </h4>
          <p className="font-mono text-[10px] text-[--text-muted] mt-1">
            {template.recommended_scene_count} scènes · {template.tone_keywords.slice(0, 3).join(' · ')}
          </p>
        </div>

        {/* Script preview */}
        <p className="font-body text-xs text-[--text-secondary] line-clamp-3 italic">
          &ldquo;{template.script_example}&rdquo;
        </p>

        {/* Tags */}
        {template.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {template.tags.slice(0, 3).map((tag) => (
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
        'absolute inset-x-0 bottom-0 px-4 py-2 bg-gradient-to-t from-blue-500/20 to-transparent transition-opacity duration-200',
        selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
      )}>
        <p className="font-mono text-[10px] uppercase tracking-wider text-blue-500 text-center">
          {selected ? '✓ Template sélectionné' : 'Cliquer pour utiliser →'}
        </p>
      </div>
    </button>
  )
}
