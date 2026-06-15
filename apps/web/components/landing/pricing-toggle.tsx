'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n'
import { PLANS, formatNumber, type Plan } from '@/components/pricing/pricing-data'

const LANDING_PLAN_IDS = ['free', 'pro', 'studio'] as const
const LANDING_PLANS: Plan[] = LANDING_PLAN_IDS
  .map((id) => PLANS.find((p) => p.id === id))
  .filter((p): p is Plan => Boolean(p))

const MAX_PERKS_ON_LANDING = 6

export function PricingToggle() {
  const [annual, setAnnual] = useState(false)
  const { t } = useLanguage()

  return (
    <div>
      <div className="flex items-center justify-center gap-3 mb-10">
        <span
          className={cn(
            'font-body text-sm',
            !annual ? 'text-foreground font-semibold' : 'text-[--text-muted]',
          )}
        >
          {t('pr_monthly')}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={annual}
          aria-label={t('pr_toggleBilling')}
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
          {t('pr_yearly')}
          <Badge variant="success">−20%</Badge>
        </span>
      </div>

      <div className="grid md:grid-cols-3 gap-6 items-stretch">
        {LANDING_PLANS.map((plan) => (
          <LandingPlanCard key={plan.id} plan={plan} annual={annual} t={t} />
        ))}
      </div>

      <p className="font-mono text-xs text-[--text-muted] text-center mt-6">
        {t('pr_landingFootnote')}
      </p>
    </div>
  )
}

function LandingPlanCard({ plan, annual, t }: { plan: Plan; annual: boolean; t: (k: string) => string }) {
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
          <Badge variant="purple">{t('pr_mostPopular')}</Badge>
        </div>
      )}
      {plan.teamBadge && (
        <div className="absolute -top-3 right-4 z-10">
          <Badge variant="warning">{t('pr_teams')}</Badge>
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
        <div className="mb-5">
          <h3
            className={cn(
              'font-display text-xl font-semibold mb-1',
              isPro && 'gradient-text',
            )}
          >
            {plan.name}
          </h3>
          <p className="font-body text-sm text-[--text-secondary]">{t(plan.subtitleKey)}</p>
        </div>

        <div className="mb-2 flex items-baseline gap-1">
          <span className="font-display text-3xl font-bold text-foreground">{price}€</span>
          <span className="font-body text-sm text-[--text-muted]">
            {plan.forever ? t('pr_forever') : t('pr_perMonth')}
          </span>
        </div>
        {!plan.forever && annual && plan.monthly !== plan.yearly && (
          <p className="font-mono text-[10px] text-[--text-muted] mb-2">
            <span className="line-through">{plan.monthly}€</span> · {t('pr_billedAnnually')}
          </p>
        )}

        <div className="mt-2 mb-5">
          <p
            className={cn(
              'font-display text-2xl font-bold',
              isPro
                ? 'bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent'
                : 'gradient-text',
            )}
          >
            {formatNumber(plan.credits)}
          </p>
          <p className="font-body text-xs text-[--text-secondary]">
            {plan.forever ? t('pr_creditsOnce') : t('pr_creditsMonth')}
          </p>
        </div>

        <div className="border-t border-border/50 pt-5 mb-5 flex flex-col gap-2.5 flex-1">
          {visiblePerks.map((perk) => (
            <div key={perk.labelKey} className="flex items-start gap-2.5">
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
                {t(perk.labelKey)}
              </span>
            </div>
          ))}
          {hiddenPerksCount > 0 && (
            <Link
              href="/pricing"
              className="font-mono text-xs text-[--text-muted] hover:text-foreground transition-colors mt-1"
            >
              + {hiddenPerksCount} {t('pr_morePerks')} →
            </Link>
          )}
        </div>

        <Link href={ctaHref}>
          <Button variant={isPro ? 'primary' : 'secondary'} fullWidth>
            {t(plan.ctaLabelKey)}
          </Button>
        </Link>
      </Card>
    </div>
  )
}
