'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Play } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'

// ── Types ───────────────────────────────────────────────────────────────────────

type Category = 'All' | 'Faceless' | 'Motion' | 'Avatar' | 'Brand'

interface Template {
  id: string
  name: string
  category: Exclude<Category, 'All'>
  gradient: string
  badgeVariant: 'info' | 'purple' | 'neutral' | 'cyan'
  description: string
}

// ── Data ────────────────────────────────────────────────────────────────────────

const TEMPLATES: Template[] = [
  {
    id: 'faceless-news',
    name: 'Daily News Recap',
    category: 'Faceless',
    gradient: 'from-blue-600 to-blue-400',
    badgeVariant: 'info',
    description: 'Auto-generated news summaries with voiceover',
  },
  {
    id: 'faceless-tips',
    name: 'Quick Tips',
    category: 'Faceless',
    gradient: 'from-blue-500 to-cyan-400',
    badgeVariant: 'info',
    description: 'Short educational tip videos with text overlays',
  },
  {
    id: 'motion-product',
    name: 'Product Showcase',
    category: 'Motion',
    gradient: 'from-purple-600 to-violet-400',
    badgeVariant: 'purple',
    description: 'Kinetic typography and animated product reveals',
  },
  {
    id: 'motion-countdown',
    name: 'Countdown Timer',
    category: 'Motion',
    gradient: 'from-purple-500 to-fuchsia-400',
    badgeVariant: 'purple',
    description: 'Launch countdown with animated elements',
  },
  {
    id: 'avatar-explainer',
    name: 'Explainer Video',
    category: 'Avatar',
    gradient: 'from-pink-600 to-rose-400',
    badgeVariant: 'neutral',
    description: 'AI avatar walks through your product step by step',
  },
  {
    id: 'avatar-testimonial',
    name: 'Testimonial',
    category: 'Avatar',
    gradient: 'from-pink-500 to-orange-400',
    badgeVariant: 'neutral',
    description: 'Realistic avatar delivers social proof messaging',
  },
  {
    id: 'brand-promo',
    name: 'Brand Promo',
    category: 'Brand',
    gradient: 'from-teal-600 to-emerald-400',
    badgeVariant: 'cyan',
    description: 'Polished brand video with logo and color system',
  },
  {
    id: 'brand-social',
    name: 'Social Story',
    category: 'Brand',
    gradient: 'from-teal-500 to-cyan-400',
    badgeVariant: 'cyan',
    description: 'Vertical story format sized for Instagram & TikTok',
  },
  {
    id: 'faceless-listicle',
    name: 'Listicle',
    category: 'Faceless',
    gradient: 'from-blue-700 to-indigo-400',
    badgeVariant: 'info',
    description: 'Top-N style videos with auto B-roll and captions',
  },
  {
    id: 'motion-intro',
    name: 'Channel Intro',
    category: 'Motion',
    gradient: 'from-violet-600 to-purple-400',
    badgeVariant: 'purple',
    description: 'Eye-catching 5-second animated channel bumper',
  },
]

const CATEGORIES: Category[] = ['All', 'Faceless', 'Motion', 'Avatar', 'Brand']

const BADGE_LABEL: Record<Exclude<Category, 'All'>, string> = {
  Faceless: 'Faceless',
  Motion: 'Motion',
  Avatar: 'Avatar',
  Brand: 'Brand',
}

// ── Page ────────────────────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const [active, setActive] = useState<Category>('All')

  const filtered =
    active === 'All' ? TEMPLATES : TEMPLATES.filter((t) => t.category === active)

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto animate-fade-in">
      <PageHeader
        eyebrow="Templates"
        title="Template Gallery"
        description="Start from a proven template and customize it"
      />

      {/* Category filter pills */}
      <div className="flex flex-wrap gap-2 mb-8">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActive(cat)}
            className={[
              'font-mono text-xs uppercase tracking-wider px-4 py-1.5 rounded-xl border transition-all duration-150',
              active === cat
                ? 'bg-primary text-white border-transparent shadow-glow-brand'
                : 'bg-muted border-border text-[--text-secondary] hover:border-border hover:text-foreground',
            ].join(' ')}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {filtered.map((tpl) => (
          <Card
            key={tpl.id}
            padding="none"
            className="overflow-hidden card-interactive group"
          >
            {/* Thumbnail */}
            <div
              className={`aspect-video w-full bg-gradient-to-br ${tpl.gradient} flex items-center justify-center relative`}
            >
              <span className="font-display font-bold text-white/90 text-sm text-center px-3 leading-snug">
                {tpl.name}
              </span>
              {/* Play overlay on hover */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/20">
                <div className="w-10 h-10 rounded-full bg-white/20 border border-white/40 flex items-center justify-center backdrop-blur-sm">
                  <Play size={16} className="text-white fill-white ml-0.5" />
                </div>
              </div>
            </div>

            {/* Card body */}
            <div className="p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display font-semibold text-foreground text-sm leading-snug">
                  {tpl.name}
                </h3>
                <Badge variant={tpl.badgeVariant} className="shrink-0">
                  {BADGE_LABEL[tpl.category]}
                </Badge>
              </div>
              <p className="font-body text-xs text-[--text-secondary] leading-relaxed">
                {tpl.description}
              </p>
              <Button
                variant="secondary"
                size="sm"
                fullWidth
                asChild
              >
                <Link href={`/projects/new?template=${tpl.id}`}>
                  Use template
                </Link>
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="font-display font-semibold text-foreground text-lg">No templates found</p>
          <p className="font-body text-sm text-[--text-muted] mt-1">
            Try a different category filter.
          </p>
        </div>
      )}
    </div>
  )
}
