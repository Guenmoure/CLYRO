'use client'

/**
 * StudioTemplateGallery — Wave 3 of the 16/06/26 UI/UX audit.
 *
 * Audit recommendation: « ajouter une bibliothèque de modèles dans le
 * Studio ». This is the curated gallery surfaced inside the /studio/new
 * page, sitting in a collapsible section above the script textarea. The
 * user picks a card → the parent prefills the textarea with the localised
 * script seed + (optionally) updates language / narration hints.
 *
 * Visual conventions
 * ──────────────────
 * • 4-column grid on lg+, 2-column on sm, 1-column on xs.
 * • Each card carries a gradient + emoji + name + 1-line description +
 *   duration pill (so the user knows whether it'll cost 1 credit or 10).
 * • Selecting a card highlights it with a ring and surfaces a « Selected »
 *   marker; clicking again deselects (no « stuck » UX).
 *
 * No backend call — everything is local data from `lib/studio-templates.ts`.
 */

import { useState } from 'react'
import { Check, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n'
import { STUDIO_TEMPLATES, getStudioTemplateText, type StudioTemplate } from '@/lib/studio-templates'

interface StudioTemplateGalleryProps {
  /** Currently selected template id (or null). Controlled by the parent. */
  selectedId:  string | null
  /** Fired when the user clicks a card. Receives the FULL template so the
   *  parent can prefill several fields at once (script + duration + hint). */
  onSelect:    (template: StudioTemplate) => void
}

export function StudioTemplateGallery({ selectedId, onSelect }: StudioTemplateGalleryProps) {
  const { t, lang } = useLanguage()
  // Optional category filter — defaults to "all". Kept inside the gallery
  // so the parent doesn't have to manage it.
  const [activeCategory, setActiveCategory] = useState<'all' | StudioTemplate['category']>('all')

  // Build the visible list lazily so changing category re-runs the filter
  // without rerunning the whole template list.
  const visible = activeCategory === 'all'
    ? STUDIO_TEMPLATES
    : STUDIO_TEMPLATES.filter((tpl) => tpl.category === activeCategory)

  // Category pills — only show categories that have at least one template.
  const categories: Array<'all' | StudioTemplate['category']> = ['all']
  for (const tpl of STUDIO_TEMPLATES) {
    if (!categories.includes(tpl.category)) categories.push(tpl.category)
  }

  return (
    <div className="space-y-3">
      {/* Eyebrow + title */}
      <div className="flex items-center gap-2">
        <Sparkles size={14} className="text-primary" />
        <p className="font-mono text-[10px] uppercase tracking-widest text-primary">
          {t('stgal_eyebrow')}
        </p>
      </div>
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-display text-lg font-bold text-foreground">
            {t('stgal_title')}
          </h3>
          <p className="font-body text-xs text-[--text-secondary] mt-0.5 max-w-xl">
            {t('stgal_subtitle')}
          </p>
        </div>
        {/* Category filter pills */}
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => {
            const active = activeCategory === c
            const labelKey = c === 'all' ? 'stgal_cat_all' : `stgal_cat_${c}`
            return (
              <button
                key={c}
                type="button"
                onClick={() => setActiveCategory(c)}
                className={cn(
                  'px-3 py-1 rounded-full text-[11px] font-mono uppercase tracking-wider border transition-colors',
                  active
                    ? 'bg-brand/10 border-brand/50 text-primary'
                    : 'bg-card border-border text-[--text-muted] hover:text-foreground hover:border-border',
                )}
              >
                {t(labelKey)}
              </button>
            )
          })}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {visible.map((tpl) => {
          const isSelected = selectedId === tpl.id
          return (
            <button
              key={tpl.id}
              type="button"
              onClick={() => onSelect(tpl)}
              className={cn(
                'group relative text-left rounded-2xl border bg-card overflow-hidden transition-all',
                isSelected
                  ? 'border-primary ring-2 ring-brand/30'
                  : 'border-border hover:border-brand/30 hover:shadow-sm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              )}
              aria-pressed={isSelected}
            >
              {/* Visual header */}
              <div className={cn(
                'relative aspect-[5/3] bg-gradient-to-br flex items-center justify-center',
                tpl.gradient,
              )}>
                <span className="text-3xl drop-shadow-sm" aria-hidden="true">{tpl.emoji}</span>
                {isSelected && (
                  <span className="absolute top-2 right-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary shadow">
                    <Check size={11} className="text-white" />
                  </span>
                )}
                <span className="absolute bottom-2 right-2 inline-flex items-center rounded-full bg-black/40 backdrop-blur-sm px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider text-white">
                  ~{tpl.duration_seconds}s
                </span>
              </div>
              {/* Body */}
              <div className="p-3 space-y-1">
                <h4 className="font-display text-sm font-semibold text-foreground leading-snug">
                  {getStudioTemplateText(tpl, 'name', lang)}
                </h4>
                <p className="font-body text-[11px] text-[--text-secondary] leading-snug line-clamp-2">
                  {getStudioTemplateText(tpl, 'description', lang)}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
