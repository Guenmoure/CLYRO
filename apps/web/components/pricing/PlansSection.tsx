'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n'
import { PLANS, formatNumber, type Plan } from './pricing-data'

export function PlansSection() {
  const [yearly, setYearly] = useState(false)
  const { t } = useLanguage()

  return (
    <section className="relative px-6 py-20">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute top-0 right-1/4 h-80 w-80 rounded-full bg-purple-500/10 blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto">
        <div className="text-center mb-12 space-y-5">
          <div className="flex justify-center">
            <Badge variant="info" dot>{t('pr_headerBadge')}</Badge>
          </div>

          <h1 className="font-display text-5xl md:text-6xl font-bold text-foreground leading-tight">
            <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">{t('pr_heroAccent')}</span>
            {' '}{t('pr_heroTitle')}
            <br />
            <span className="text-[--text-secondary]">{t('pr_heroSubtitle')}</span>
          </h1>

          <p className="font-body text-lg text-[--text-secondary] max-w-2xl mx-auto">
            {t('pr_heroDesc')}
          </p>

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
              {t('pr_monthly')}
            </button>

            <button
              type="button"
              onClick={() => setYearly((v) => !v)}
              className={cn(
                'relative w-12 h-6 rounded-full transition-colors',
                yearly ? 'bg-[--primary]' : 'bg-muted border border-border',
              )}
              role="switch"
              aria-checked={yearly}
              aria-label={t('pr_toggleBilling')}
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
              {t('pr_yearly')}
              <Badge variant="success">-20%</Badge>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-5 px-0 md:px-0 overflow-x-auto md:overflow-visible snap-x md:snap-none pb-4 md:pb-0">
          {PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} yearly={yearly} t={t} />
          ))}
        </div>

        <p className="font-mono text-xs text-[--text-muted] text-center mt-8 max-w-3xl mx-auto leading-relaxed">
          {t('pr_plansFootnote')}
        </p>
      </div>
    </section>
  )
}

function PlanCard({ plan, yearly, t }: { plan: Plan; yearly: boolean; t: (k: string) => string }) {
  const price = yearly ? plan.yearly : plan.monthly
  const isFree = plan.id === 'free'
  const isPro  = plan.highlight

  return (
    <div className={cn(
      'relative snap-start shrink-0 w-[82vw] md:w-auto',
      isPro && 'md:scale-[1.03] md:z-10',
    )}>
      {isPro && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
          <Badge variant="purple">{t('pr_mostPopular')}</Badge>
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
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className={cn(
              'font-display text-xl font-bold',
              isPro ? 'bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent' : 'text-foreground',
            )}>
              {plan.name}
            </h3>
            {plan.teamBadge && <Badge variant="warning">{t('pr_teams')}</Badge>}
          </div>
          <p className="font-body text-xs text-[--text-secondary]">{t(plan.subtitleKey)}</p>
        </div>

        <div className="mt-5 space-y-1">
          <div className="flex items-baseline gap-1">
            <span className="font-display text-3xl font-bold text-foreground">
              {price}€
            </span>
            {!plan.forever && (
              <span className="font-mono text-xs text-[--text-muted]">{t('pr_perMonth')}</span>
            )}
            {plan.forever && (
              <span className="font-mono text-xs text-[--text-muted]">{t('pr_forever')}</span>
            )}
          </div>
          {!plan.forever && yearly && plan.monthly !== plan.yearly && (
            <p className="font-mono text-[10px] text-[--text-muted]">
              <span className="line-through">{plan.monthly}€</span>
              {' '}· {t('pr_billedAnnually')}
            </p>
          )}
          {isFree && <Badge variant="neutral">{t('pr_noCardRequired')}</Badge>}
        </div>

        <div className="mt-5 space-y-1">
          <p className={cn(
            'font-display text-4xl font-bold',
            isPro
              ? 'bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent'
              : 'gradient-text',
          )}>
            {formatNumber(plan.credits)}
          </p>
          <p className="font-body text-xs text-[--text-secondary]">
            {plan.forever ? t('pr_creditsOnce') : t('pr_creditsMonth')}
          </p>
          {plan.id === 'starter' && (
            <p className="font-mono text-[10px] text-[--text-muted]">{t('pr_starterNote')}</p>
          )}
          {plan.id === 'pro' && (
            <p className="font-mono text-[10px] text-[--text-muted]">{t('pr_proNote')}</p>
          )}
          {plan.id === 'creator' && (
            <p className="font-mono text-[10px] text-[--text-muted]">{t('pr_creatorNote')}</p>
          )}
          {plan.id === 'studio' && (
            <p className="font-mono text-[10px] text-[--text-muted]">{t('pr_studioNote')}</p>
          )}
        </div>

        <div className="h-px bg-border my-5" />

        <ul className="space-y-2.5 flex-1">
          {plan.perks.map((perk, i) => (
            <li key={i} className="flex items-start gap-2 text-xs font-body">
              {perk.included ? (
                <Check size={13} className="text-success shrink-0 mt-0.5" />
              ) : (
                <X size={13} className="text-error/70 shrink-0 mt-0.5" />
              )}
              <span className={perk.included ? 'text-foreground' : 'text-[--text-muted] line-through'}>
                {t(perk.labelKey)}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-6">
          <Button
            variant={isPro ? 'primary' : 'secondary'}
            size="md"
            fullWidth
            asChild
          >
            <Link href={isFree ? '/signup' : '/signup?plan=' + plan.id}>
              {t(plan.ctaLabelKey)}
            </Link>
          </Button>
        </div>
      </Card>
    </div>
  )
}
