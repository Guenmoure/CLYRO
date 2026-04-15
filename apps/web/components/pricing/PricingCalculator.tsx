'use client'

import { useState } from 'react'
import { Info, ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  PLANS, CREDIT_COST_PER_MIN, MODE_META,
  videosPerMonth, secondsAvailable, creditsForVideo, formatNumber,
  type PlanId, type Mode,
} from './pricing-data'

// ── Durations displayed in the summary table
const DURATIONS_MIN = [0.5, 1, 2, 5, 8, 10, 15]

function durationLabel(min: number): string {
  if (min < 1) return `${Math.round(min * 60)}s`
  return `${min}min`
}

export function PricingCalculator() {
  const [planId, setPlanId] = useState<PlanId>('pro')
  const [sliderMin, setSliderMin] = useState(5)
  const [selectedMode, setSelectedMode] = useState<Mode>('fast')
  const [tableOpen, setTableOpen] = useState(false)

  const plan = PLANS.find((p) => p.id === planId)!
  const credits = plan.credits

  // Calculations per mode
  const secondsByMode: Record<Mode, number> = {
    storyboard: secondsAvailable(credits, 'storyboard'),
    fast:       secondsAvailable(credits, 'fast'),
    pro:        secondsAvailable(credits, 'pro'),
  }

  const valueEurIfTopup = (credits * 0.015).toFixed(2)

  // Interactive example
  const exampleVideos = videosPerMonth(credits, sliderMin, selectedMode)
  const creditsUsed   = exampleVideos * creditsForVideo(sliderMin, selectedMode)
  const creditsLeft   = credits - creditsUsed

  return (
    <section className="relative px-6 py-20">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10 space-y-3">
          <div className="flex justify-center">
            <Badge variant="neutral">Calculateur de crédits</Badge>
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground">
            Combien de secondes obtenez-vous ?
          </h2>
          <p className="font-body text-[--text-secondary] max-w-2xl mx-auto">
            Le nombre de crédits consommés dépend du mode d&apos;animation et de la durée de ta vidéo.
          </p>
        </div>

        {/* Main card */}
        <Card variant="glass" padding="lg">

          {/* Plan selector pills */}
          <div className="flex flex-wrap gap-2 justify-center mb-6">
            {PLANS.map((p) => {
              const active = p.id === planId
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlanId(p.id)}
                  className={cn(
                    'rounded-full border px-4 py-1.5 font-body text-sm transition-all',
                    active
                      ? 'bg-blue-500/20 border-blue-500 text-blue-400 font-semibold'
                      : 'bg-muted border-border text-[--text-secondary] hover:text-foreground hover:border-border',
                  )}
                  aria-pressed={active}
                >
                  {p.name}
                </button>
              )
            })}
          </div>

          {/* Credits for the selected plan */}
          <div className="text-center py-6 border-y border-border space-y-2">
            <p className="font-display text-5xl md:text-6xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              {formatNumber(credits)}
              <span className="ml-2 font-body text-lg text-foreground">crédits / mois</span>
            </p>
            <p className="font-mono text-xs text-[--text-muted]">
              Valeur : {valueEurIfTopup}€ si acheté en top-up
            </p>
          </div>

          {/* 3 modes grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            {(Object.keys(MODE_META) as Mode[]).map((mode) => {
              const meta = MODE_META[mode]
              const sec = secondsByMode[mode]
              const min = (sec / 60).toFixed(1)
              return (
                <div
                  key={mode}
                  className={cn(
                    'rounded-2xl border bg-muted/40 overflow-hidden',
                    meta.accent,
                  )}
                >
                  <div className={cn('px-4 py-2 border-b border-inherit bg-background/40', meta.color)}>
                    <p className="font-mono text-[11px] uppercase tracking-widest font-semibold">
                      {meta.label}
                    </p>
                  </div>
                  <div className="px-4 py-4 space-y-2">
                    <div>
                      <p className="font-display text-2xl font-bold text-foreground">
                        {formatNumber(sec)} <span className="text-sm font-body font-normal text-[--text-secondary]">s</span>
                      </p>
                      <p className="font-mono text-[11px] text-[--text-muted]">≈ {min} min de vidéo</p>
                    </div>
                    <ul className="space-y-0.5 font-body text-xs text-[--text-secondary] leading-relaxed">
                      <li>{videosPerMonth(credits, 2, mode)} vidéos de 2 min</li>
                      <li>{videosPerMonth(credits, 5, mode)} vidéos de 5 min</li>
                      <li>{videosPerMonth(credits, 10, mode)} vidéos de 10 min</li>
                      <li>{videosPerMonth(credits, 15, mode)} vidéos de 15 min</li>
                    </ul>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Info note */}
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
            <Info size={16} className="text-blue-400 shrink-0 mt-0.5" />
            <p className="font-body text-xs text-[--text-secondary] leading-relaxed">
              Les crédits non utilisés sont reportés automatiquement au mois suivant et n&apos;expirent jamais.
              Les top-ups s&apos;ajoutent à ton solde sans date d&apos;expiration.
            </p>
          </div>
        </Card>

        {/* Interactive example */}
        <Card variant="default" padding="lg" className="mt-6">
          <p className="font-mono text-[11px] uppercase tracking-widest text-[--text-secondary] font-semibold mb-4">
            Exemple concret
          </p>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-start">
            {/* Controls */}
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="duration-slider" className="font-body text-sm text-foreground">
                    Durée de ta vidéo type
                  </label>
                  <span className="font-mono text-sm text-blue-400 font-semibold">{sliderMin} min</span>
                </div>
                <input
                  id="duration-slider"
                  type="range"
                  min={1}
                  max={15}
                  value={sliderMin}
                  onChange={(e) => setSliderMin(Number(e.target.value))}
                  className="w-full h-2 appearance-none rounded-full bg-muted accent-blue-500 cursor-pointer"
                />
                <div className="flex justify-between font-mono text-[10px] text-[--text-muted] mt-1">
                  <span>1min</span>
                  <span>15min</span>
                </div>
              </div>

              <div>
                <p className="font-body text-sm text-foreground mb-2">Mode d&apos;animation</p>
                <div className="flex gap-2 flex-wrap">
                  {(Object.keys(MODE_META) as Mode[]).map((m) => {
                    const active = selectedMode === m
                    const meta = MODE_META[m]
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setSelectedMode(m)}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 font-body text-xs transition-all',
                          active
                            ? m === 'pro'
                              ? 'bg-purple-500/15 border-purple-500 text-purple-400 font-semibold'
                              : m === 'fast'
                                ? 'bg-amber-500/15 border-amber-500 text-amber-400 font-semibold'
                                : 'bg-blue-500/15 border-blue-500 text-blue-400 font-semibold'
                            : 'bg-muted border-border text-[--text-secondary] hover:text-foreground',
                        )}
                        aria-pressed={active}
                      >
                        {meta.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Result */}
            <div className="rounded-2xl border border-blue-500/30 bg-blue-500/5 px-5 py-5 text-center space-y-1 md:w-64">
              <p className="font-display text-3xl font-bold text-foreground">
                {exampleVideos}
              </p>
              <p className="font-body text-xs text-[--text-secondary]">
                vidéos de {sliderMin} min en mode {MODE_META[selectedMode].label} par mois
              </p>
              <p className="font-mono text-[10px] text-[--text-muted] pt-1">
                Il te reste {formatNumber(Math.max(0, creditsLeft))} crédits pour d&apos;autres créations.
              </p>
            </div>
          </div>
        </Card>

        {/* Complete table accordion */}
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setTableOpen((v) => !v)}
            className="w-full flex items-center justify-between rounded-xl border border-border bg-card hover:bg-muted transition-colors px-5 py-4 group"
            aria-expanded={tableOpen}
          >
            <span className="font-display text-sm font-semibold text-foreground">
              Tableau complet des crédits par durée
            </span>
            <ChevronDown
              size={16}
              className={cn('text-[--text-secondary] transition-transform', tableOpen && 'rotate-180')}
            />
          </button>

          {tableOpen && (
            <div className="mt-2 rounded-2xl border border-border bg-card overflow-hidden">
              <div className="grid grid-cols-4 border-b border-border bg-muted/40 text-center">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[--text-secondary] font-semibold py-3">Durée</span>
                <span className="font-mono text-[10px] uppercase tracking-widest text-[--text-secondary] font-semibold py-3">Storyboard</span>
                <span className="font-mono text-[10px] uppercase tracking-widest text-amber-400 font-semibold py-3">Fast</span>
                <span className="font-mono text-[10px] uppercase tracking-widest text-purple-400 font-semibold py-3">Pro</span>
              </div>
              {DURATIONS_MIN.map((d) => {
                const highlight = d === 5
                return (
                  <div
                    key={d}
                    className={cn(
                      'grid grid-cols-4 text-center border-t border-border first:border-t-0',
                      highlight ? 'bg-blue-500/5' : '',
                    )}
                  >
                    <span className="font-mono text-sm text-foreground py-3">{durationLabel(d)}</span>
                    <span className="font-mono text-sm text-[--text-secondary] py-3">{Math.ceil(creditsForVideo(d, 'storyboard'))}</span>
                    <span className="font-mono text-sm text-amber-400 py-3">{Math.ceil(creditsForVideo(d, 'fast'))}</span>
                    <span className="font-mono text-sm text-purple-400 py-3">{Math.ceil(creditsForVideo(d, 'pro'))}</span>
                  </div>
                )
              })}
              <p className="px-4 py-3 border-t border-border bg-muted/40 font-mono text-[10px] text-[--text-muted] text-center">
                ⓘ Ligne 5min mise en valeur — durée recommandée pour YouTube Shorts & TikTok
              </p>
            </div>
          )}
        </div>

        {/* Unused variable silencer */}
        <span className="hidden">{CREDIT_COST_PER_MIN.storyboard}</span>
      </div>
    </section>
  )
}
