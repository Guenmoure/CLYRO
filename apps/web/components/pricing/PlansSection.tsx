'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { PLANS, formatNumber, type Plan } from './pricing-data'

export function PlansSection() {
  const [yearly, setYearly] = useState(false)

  return (
    <section className="relative px-6 py-20">
      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute top-0 right-1/4 h-80 w-80 rounded-full bg-purple-500/10 blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 space-y-5">
          <div className="flex justify-center">
            <Badge variant="info" dot>Tarifs simples et transparents</Badge>
          </div>

          <h1 className="font-display text-5xl md:text-6xl font-bold text-foreground leading-tight">
            <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">Crée.</span>
            {' '}Publie. Répète.
            <br />
            <span className="text-[--text-secondary]">Sans surprise sur la facture.</span>
          </h1>

          <p className="font-body text-lg text-[--text-secondary] max-w-2xl mx-auto">
            Un crédit = une unité de génération. Choisis ton mode d&apos;animation,
            consomme ce que tu utilises, accumule ce que tu n&apos;utilises pas.
          </p>

          {/* Monthly / Yearly toggle */}
          <div className="inline-flex items-center gap-3 pt-3">
            <button
              type="button"
              onClick={() => setYearly(false)}
              className={cn(
                'font-body text-sm transition-colors',
                !yearly ? 'text-foreground font-semibold' : 'text-[--text-muted] hover:text-foreground',
              )}
              aria-pressed={!yearly}
            >
              Mensuel
            </button>

            <button
              type="button"
              onClick={() => setYearly((v) => !v)}
              className={cn(
                'relative w-12 h-6 rounded-full transition-colors',
                yearly ? 'bg-blue-500' : 'bg-muted border border-border',
              )}
              role="switch"
              aria-checked={yearly}
              aria-label="Basculer entre mensuel et annuel"
            >
              <span className={cn(
                'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                yearly ? 'translate-x-6' : 'translate-x-0.5',
              )} />
            </button>

            <button
              type="button"
              onClick={() => setYearly(true)}
              className={cn(
                'inline-flex items-center gap-2 font-body text-sm transition-colors',
                yearly ? 'text-foreground font-semibold' : 'text-[--text-muted] hover:text-foreground',
              )}
              aria-pressed={yearly}
            >
              Annuel
              <Badge variant="success">-20%</Badge>
            </button>
          </div>
        </div>

        {/* Plans grid — scrolls horizontally on mobile */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-5 px-0 md:px-0 overflow-x-auto md:overflow-visible snap-x md:snap-none pb-4 md:pb-0">
          {PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} yearly={yearly} />
          ))}
        </div>

        <p className="font-mono text-xs text-[--text-muted] text-center mt-8 max-w-3xl mx-auto leading-relaxed">
          ✓ Sans engagement — annulation à tout moment
          {' · '}✓ Crédits jamais perdus (roll-over permanent)
          {' · '}✓ Paiement par carte ou Mobile Money (Orange Money, Wave, MTN)
        </p>
      </div>
    </section>
  )
}

// ── PlanCard ─────────────────────────────────────────────────────────────

function PlanCard({ plan, yearly }: { plan: Plan; yearly: boolean }) {
  const price = yearly ? plan.yearly : plan.monthly
  const isFree = plan.id === 'free'
  const isPro  = plan.highlight

  return (
    <div className={cn(
      'relative snap-start shrink-0 w-[82vw] md:w-auto',
      isPro && 'md:scale-[1.03] md:z-10',
    )}>
      {/* Popular badge */}
      {isPro && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
          <Badge variant="purple">Le plus populaire</Badge>
        </div>
      )}

      <Card
        variant={isPro ? 'gradient' : isFree ? 'default' : 'elevated'}
        padding="lg"
        className={cn(
          'h-full flex flex-col',
          isPro && 'border-2 border-blue-500/50 shadow-[0_0_40px_-8px_rgba(59,142,240,0.3)]',
        )}
      >
        {/* Header: name + subtitle */}
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className={cn(
              'font-display text-xl font-bold',
              isPro ? 'bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent' : 'text-foreground',
            )}>
              {plan.name}
            </h3>
            {plan.teamBadge && <Badge variant="warning">Équipes</Badge>}
          </div>
          <p className="font-body text-xs text-[--text-secondary]">{plan.subtitle}</p>
        </div>

        {/* Price */}
        <div className="mt-5 space-y-1">
          <div className="flex items-baseline gap-1">
            <span className="font-display text-3xl font-bold text-foreground">
              {price}€
            </span>
            {!plan.forever && (
              <span className="font-mono text-xs text-[--text-muted]">/mois</span>
            )}
            {plan.forever && (
              <span className="font-mono text-xs text-[--text-muted]">pour toujours</span>
            )}
          </div>
          {!plan.forever && yearly && plan.monthly !== plan.yearly && (
            <p className="font-mono text-[10px] text-[--text-muted]">
              <span className="line-through">{plan.monthly}€</span>
              {' '}· facturé annuellement
            </p>
          )}
          {isFree && <Badge variant="neutral">Aucune carte requise</Badge>}
        </div>

        {/* Credits highlight */}
        <div className="mt-5 space-y-1">
          <p className={cn(
            'font-display text-4xl font-bold',
            isPro
              ? 'bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent'
              : 'bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent',
          )}>
            {formatNumber(plan.credits)}
          </p>
          <p className="font-body text-xs text-[--text-secondary]">
            {plan.forever ? 'crédits offerts (1 fois)' : 'crédits / mois'}
          </p>
          {plan.id === 'starter' && (
            <p className="font-mono text-[10px] text-[--text-muted]">Roll-over mensuel actif</p>
          )}
          {plan.id === 'pro' && (
            <p className="font-mono text-[10px] text-[--text-muted]">≈ 25 vidéos Fast 5min/mois</p>
          )}
          {plan.id === 'creator' && (
            <p className="font-mono text-[10px] text-[--text-muted]">≈ 75 vidéos Fast 5min/mois</p>
          )}
          {plan.id === 'studio' && (
            <p className="font-mono text-[10px] text-[--text-muted]">≈ 208 vidéos Fast 5min/mois</p>
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-border my-5" />

        {/* Perks */}
        <ul className="space-y-2.5 flex-1">
          {plan.perks.map((perk, i) => (
            <li key={i} className="flex items-start gap-2 text-xs font-body">
              {perk.included ? (
                <Check size={13} className="text-success shrink-0 mt-0.5" />
              ) : (
                <X size={13} className="text-error/70 shrink-0 mt-0.5" />
              )}
              <span className={perk.included ? 'text-foreground' : 'text-[--text-muted] line-through'}>
                {perk.label}
              </span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <div className="mt-6">
          <Button
            variant={isPro ? 'primary' : 'secondary'}
            size="md"
            fullWidth
            asChild
          >
            <Link href={isFree ? '/signup' : '/signup?plan=' + plan.id}>
              {plan.ctaLabel}
            </Link>
          </Button>
        </div>
      </Card>
    </div>
  )
}
