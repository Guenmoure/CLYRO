'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { PLANS, formatNumber, type Plan } from '@/components/pricing/pricing-data'

// Sélection des 3 plans mis en avant sur la landing.
// La page /pricing reste la source complète (5 plans).
const LANDING_PLAN_IDS = ['free', 'pro', 'studio'] as const
const LANDING_PLANS: Plan[] = LANDING_PLAN_IDS
  .map((id) => PLANS.find((p) => p.id === id))
  .filter((p): p is Plan => Boolean(p))

// Cap perks list on the landing pour rester compact (la page /pricing montre tout).
const MAX_PERKS_ON_LANDING = 6

export function PricingToggle() {
  const [annual, setAnnual] = useState(false)

  return (
    <div>
      {/* Toggle Mensuel / Annuel */}
      <div className="flex items-center justify-center gap-3 mb-10">
        <span
          className={cn(
            'font-body text-sm',
            !annual ? 'text-foreground font-semibold' : 'text-[--text-muted]',
          )}
        >
          Mensuel
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={annual}
          aria-label="Basculer entre mensuel et annuel"
          onClick={() => setAnnual((v) => !v)}
          className={cn(
            'relative w-11 h-6 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50',
            annual ? 'bg-blue-500' : 'bg-border',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200',
              annual && 'translate-x-5',
            )}
          />
        </button>
        <span
          className={cn(
            'font-body text-sm flex items-center gap-2',
            annual ? 'text-foreground font-semibold' : 'text-[--text-muted]',
          )}
        >
          Annuel
          <Badge variant="success">−20%</Badge>
        </span>
      </div>

      {/* Plans grid (3 plans) */}
      <div className="grid md:grid-cols-3 gap-6 items-stretch">
        {LANDING_PLANS.map((plan) => (
          <LandingPlanCard key={plan.id} plan={plan} annual={annual} />
        ))}
      </div>

      <p className="font-mono text-xs text-[--text-muted] text-center mt-6">
        ✓ Sans carte bancaire pour le Free · ✓ Annulation à tout moment ·
        ✓ Paiement par carte ou Mobile Money (Orange Money, Wave, MTN)
      </p>
    </div>
  )
}

// ── Carte plan (variante landing, compacte) ──────────────────────────────────

function LandingPlanCard({ plan, annual }: { plan: Plan; annual: boolean }) {
  const price = annual ? plan.yearly : plan.monthly
  const isFree = plan.id === 'free'
  const isPro = plan.highlight
  const visiblePerks = plan.perks.slice(0, MAX_PERKS_ON_LANDING)
  const hiddenPerksCount = Math.max(plan.perks.length - MAX_PERKS_ON_LANDING, 0)

  const ctaHref = isFree
    ? '/signup'
    : plan.id === 'studio'
      ? '/legal/contact'
      : `/signup?plan=${plan.id}`

  return (
    <div className={cn('relative h-full', isPro && 'md:scale-[1.02] md:z-10')}>
      {isPro && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
          <Badge variant="purple">Le plus populaire</Badge>
        </div>
      )}
      {plan.teamBadge && (
        <div className="absolute -top-3 right-4 z-10">
          <Badge variant="warning">Équipes</Badge>
        </div>
      )}

      <Card
        variant={isPro ? 'gradient' : isFree ? 'default' : 'elevated'}
        padding="lg"
        className={cn(
          'h-full flex flex-col',
          isPro && 'border-2 border-blue-500/40 shadow-[0_0_40px_-8px_rgba(59,142,240,0.3)]',
        )}
      >
        {/* Nom + sous-titre */}
        <div className="mb-5">
          <h3
            className={cn(
              'font-display text-xl font-semibold mb-1',
              isPro && 'gradient-text',
            )}
          >
            {plan.name}
          </h3>
          <p className="font-body text-sm text-[--text-secondary]">{plan.subtitle}</p>
        </div>

        {/* Prix */}
        <div className="mb-2 flex items-baseline gap-1">
          <span className="font-display text-3xl font-bold text-foreground">{price}€</span>
          <span className="font-body text-sm text-[--text-muted]">
            {plan.forever ? 'pour toujours' : '/mois'}
          </span>
        </div>
        {!plan.forever && annual && plan.monthly !== plan.yearly && (
          <p className="font-mono text-[10px] text-[--text-muted] mb-2">
            <span className="line-through">{plan.monthly}€</span> · facturé annuellement
          </p>
        )}

        {/* Crédits */}
        <div className="mt-2 mb-5">
          <p
            className={cn(
              'font-display text-2xl font-bold',
              isPro
                ? 'bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent'
                : 'bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent',
            )}
          >
            {formatNumber(plan.credits)}
          </p>
          <p className="font-body text-xs text-[--text-secondary]">
            {plan.forever ? 'crédits offerts (1 fois)' : 'crédits / mois'}
          </p>
        </div>

        {/* Perks (cap à MAX_PERKS_ON_LANDING) */}
        <div className="border-t border-border/50 pt-5 mb-5 flex flex-col gap-2.5 flex-1">
          {visiblePerks.map((perk) => (
            <div key={perk.label} className="flex items-start gap-2.5">
              {perk.included ? (
                <Check size={14} className="text-success shrink-0 mt-0.5" />
              ) : (
                <X size={14} className="text-error/70 shrink-0 mt-0.5" />
              )}
              <span
                className={cn(
                  'font-body text-sm',
                  perk.included
                    ? 'text-[--text-secondary]'
                    : 'text-[--text-muted] line-through',
                )}
              >
                {perk.label}
              </span>
            </div>
          ))}
          {hiddenPerksCount > 0 && (
            <Link
              href="/pricing"
              className="font-mono text-xs text-[--text-muted] hover:text-foreground transition-colors mt-1"
            >
              + {hiddenPerksCount} avantages supplémentaires →
            </Link>
          )}
        </div>

        {/* CTA */}
        <Link href={ctaHref}>
          <Button variant={isPro ? 'primary' : 'secondary'} fullWidth>
            {plan.ctaLabel}
          </Button>
        </Link>
      </Card>
    </div>
  )
}
