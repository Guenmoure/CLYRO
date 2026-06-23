'use client'

/**
 * Templates — editorial gallery (Vague 2, 23/06/26).
 *
 *   • PageHeader : eyebrow « Library » + folio + h-display + lead + rule
 *   • ed-tabs    : All / Faceless / Motion / Avatar / Brand
 *   • Grid       : editorial tile per template — striped placeholder
 *                  (with category folio + tag), tile body with eyebrow +
 *                  h-card + description + « Use template → » pill.
 *
 * No real thumbnails yet → handoff's `ph` striped placeholder fills the
 * gap with a clear category mark. Once thumbnails ship, replace `<div
 * className="ph">` with an <img>.
 */

import { useState } from 'react'
import Link from 'next/link'

type Category = 'All' | 'Faceless' | 'Motion' | 'Avatar' | 'Brand'

interface Template {
  id:          string
  folio:       string
  name:        string
  category:    Exclude<Category, 'All'>
  description: string
}

const TEMPLATES: Template[] = [
  { id: 'faceless-news',       folio: 'TPL.01', name: 'Daily News Recap',  category: 'Faceless', description: 'Auto-generated news summaries with voiceover.' },
  { id: 'faceless-tips',       folio: 'TPL.02', name: 'Quick Tips',        category: 'Faceless', description: 'Short educational tip videos with text overlays.' },
  { id: 'motion-product',      folio: 'TPL.03', name: 'Product Showcase',  category: 'Motion',   description: 'Kinetic typography and animated product reveals.' },
  { id: 'motion-countdown',    folio: 'TPL.04', name: 'Countdown Timer',   category: 'Motion',   description: 'Launch countdown with animated elements.' },
  { id: 'avatar-explainer',    folio: 'TPL.05', name: 'Explainer Video',   category: 'Avatar',   description: 'AI avatar walks through your product step by step.' },
  { id: 'avatar-testimonial',  folio: 'TPL.06', name: 'Testimonial',       category: 'Avatar',   description: 'Realistic avatar delivers social-proof messaging.' },
  { id: 'brand-promo',         folio: 'TPL.07', name: 'Brand Promo',       category: 'Brand',    description: 'Polished brand video with logo and color system.' },
  { id: 'brand-social',        folio: 'TPL.08', name: 'Social Story',      category: 'Brand',    description: 'Vertical story sized for Instagram & TikTok.' },
  { id: 'faceless-listicle',   folio: 'TPL.09', name: 'Listicle',          category: 'Faceless', description: 'Top-N style videos with auto B-roll and captions.' },
  { id: 'motion-intro',        folio: 'TPL.10', name: 'Channel Intro',     category: 'Motion',   description: 'Eye-catching 5-second animated channel bumper.' },
]

const CATEGORIES: Category[] = ['All', 'Faceless', 'Motion', 'Avatar', 'Brand']

export default function TemplatesPage() {
  const [active, setActive] = useState<Category>('All')
  const filtered = active === 'All' ? TEMPLATES : TEMPLATES.filter((t) => t.category === active)

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="px-4 sm:px-6 lg:px-12 py-12 max-w-6xl mx-auto">

        {/* ── Editorial page header ───────────────────────────── */}
        <header className="mb-8">
          <div className="divider-with-num">
            <span className="eyebrow">Library</span>
            <hr />
            <span className="folio">№ 08 / 12</span>
          </div>
          <h1 className="h-display">Templates</h1>
          <p className="lead mt-5">
            Start from a proven template and customise it. Filter by kind to see
            only the bumpers, explainers or vertical stories you need.
          </p>
          <hr className="rule-thin mt-8" />
        </header>

        {/* ── Editorial tabs ────────────────────────────────── */}
        <div className="ed-tabs" role="tablist" aria-label="Template categories">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={active === cat}
              onClick={() => setActive(cat)}
              className={'ed-tab' + (active === cat ? ' active' : '')}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* ── Grid ────────────────────────────────────────────── */}
        {filtered.length === 0 ? (
          <div className="py-24 text-center">
            <p className="h-card">No templates found.</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[--text-muted] mt-3">
              Try a different category.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((tpl) => (
              <Link
                key={tpl.id}
                href={`/projects/new?template=${tpl.id}`}
                className="tile block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                aria-label={`Use template ${tpl.name}`}
              >
                <div className="ph" style={{ aspectRatio: '16 / 11' }}>
                  <div className="ph-folio">{tpl.folio}</div>
                  <span className="ph-label">{tpl.name}</span>
                  <span className="ph-tag">{tpl.category.toUpperCase()}</span>
                </div>
                <div className="tile-body">
                  <div className="folio mb-2">{tpl.category.toUpperCase()}</div>
                  <h3 className="h-card">{tpl.name}</h3>
                  <p className="font-body text-sm text-[--text-secondary] leading-relaxed mt-2 min-h-[2.8em]">
                    {tpl.description}
                  </p>
                  <div className="mt-3 pt-3 border-t border-border/60 flex items-baseline justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-foreground">
                      Use template →
                    </span>
                    <span className="folio">{tpl.folio}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
