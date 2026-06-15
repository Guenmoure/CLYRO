'use client'

import Link from 'next/link'
import {
  Shield, RefreshCw, CreditCard, Smartphone,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n'
import { formatNumber } from './pricing-data'

interface TopupConfig {
  id: string
  name: string
  credits: number
  priceEur: number
  perCreditEur: number
  headBadgeKey?: string
  headBadgeVariant?: React.ComponentProps<typeof Badge>['variant']
  badgeKey: string
  badgeVariant: React.ComponentProps<typeof Badge>['variant']
  equivKeys: string[]
  variant: 'default' | 'elevated' | 'gradient'
  primary?: boolean
}

const TOPUPS: TopupConfig[] = [
  {
    id: 'boost',
    name: 'Boost',
    credits: 500,
    priceEur: 8,
    perCreditEur: 0.016,
    badgeKey: 'pr_topBadge1',
    badgeVariant: 'neutral',
    equivKeys: ['pr_topEquiv1_1', 'pr_topEquiv1_2'],
    variant: 'elevated',
  },
  {
    id: 'pro-boost',
    name: 'Pro Boost',
    credits: 1500,
    priceEur: 20,
    perCreditEur: 0.013,
    badgeKey: 'pr_topBadge2',
    badgeVariant: 'info',
    equivKeys: ['pr_topEquiv2_1', 'pr_topEquiv2_2'],
    variant: 'elevated',
  },
  {
    id: 'power',
    name: 'Power',
    credits: 5000,
    priceEur: 55,
    perCreditEur: 0.011,
    headBadgeKey: 'pr_topHead3',
    headBadgeVariant: 'purple',
    badgeKey: 'pr_topBadge3',
    badgeVariant: 'purple',
    equivKeys: ['pr_topEquiv3_1', 'pr_topEquiv3_2'],
    variant: 'gradient',
    primary: true,
  },
  {
    id: 'studio',
    name: 'Studio',
    credits: 15000,
    priceEur: 130,
    perCreditEur: 0.0087,
    badgeKey: 'pr_topBadge4',
    badgeVariant: 'success',
    equivKeys: ['pr_topEquiv4_1', 'pr_topEquiv4_2'],
    variant: 'elevated',
  },
]

export function CreditTopups() {
  const { t } = useLanguage()

  return (
    <section className="bg-muted/30 px-6 py-20">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10 space-y-3">
          <div className="flex justify-center">
            <Badge variant="neutral">Top-ups</Badge>
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground">
            {t('pr_topTitle')}
          </h2>
          <p className="font-body text-[--text-secondary] max-w-2xl mx-auto">
            {t('pr_topSubtitle')}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {TOPUPS.map((item) => (
            <div key={item.id} className="relative">
              {item.headBadgeKey && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <Badge variant={item.headBadgeVariant!}>{t(item.headBadgeKey)}</Badge>
                </div>
              )}
              <Card
                variant={item.variant}
                padding="md"
                hoverable
                className={cn(
                  'h-full flex flex-col',
                  item.primary && 'border-2 border-blue-500/50 shadow-[0_0_30px_-8px_rgba(59,142,240,0.3)]',
                )}
              >
                <p className="font-display text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                  {formatNumber(item.credits)}
                </p>
                <p className="font-body text-xs text-[--text-secondary] -mt-1">{t('pr_topCredits')}</p>

                <div className="mt-4">
                  <p className="font-display text-xl font-bold text-foreground">{item.priceEur}€</p>
                  <p className="font-mono text-[10px] text-[--text-muted]">
                    {item.perCreditEur.toFixed(item.perCreditEur < 0.01 ? 4 : 3)}€ / {t('pr_topPerCredit')}
                  </p>
                </div>

                <div className="mt-3">
                  <Badge variant={item.badgeVariant}>{t(item.badgeKey)}</Badge>
                </div>

                <ul className="mt-3 space-y-1 flex-1">
                  {item.equivKeys.map((ek) => (
                    <li key={ek} className="font-body text-[11px] text-[--text-secondary] leading-relaxed">
                      {t(ek)}
                    </li>
                  ))}
                </ul>

                <div className="mt-4">
                  <Button
                    variant={item.primary ? 'primary' : 'secondary'}
                    size="sm"
                    fullWidth
                    asChild
                  >
                    <Link href="/settings?tab=billing&topup=true">{t('pr_topCta')}</Link>
                  </Button>
                </div>
              </Card>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center flex-wrap gap-x-6 gap-y-2 mt-10 font-mono text-xs text-[--text-secondary]">
          <span className="inline-flex items-center gap-1.5">
            <Shield size={13} className="text-success" />
            {t('pr_topNoExpiry')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <RefreshCw size={13} className="text-blue-400" />
            {t('pr_topAddBalance')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CreditCard size={13} className="text-purple-400" />
            {t('pr_topStripe')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Smartphone size={13} className="text-amber-400" />
            {t('pr_topMobileMoney')}
          </span>
        </div>

        <Card variant="glass" padding="lg" className="mt-10 max-w-lg mx-auto text-center">
          <p className="font-body text-sm text-foreground">
            {t('pr_topCompareTitle')}
          </p>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="rounded-xl border border-border bg-muted/40 px-3 py-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[--text-muted]">{t('pr_topCompSub')}</p>
              <p className="font-display text-lg font-bold text-foreground mt-1">{t('pr_topCompSubPrice')}</p>
              <p className="font-mono text-[10px] text-[--text-muted] mt-0.5">{t('pr_topCompSubDetail')}</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/40 px-3 py-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[--text-muted]">{t('pr_topCompTopup')}</p>
              <p className="font-display text-lg font-bold text-foreground mt-1">{t('pr_topCompTopupPrice')}</p>
              <p className="font-mono text-[10px] text-[--text-muted] mt-0.5">{t('pr_topCompTopupDetail')}</p>
            </div>
          </div>
          <div className="mt-4 flex justify-center">
            <Badge variant="success">{t('pr_topCompWinner')}</Badge>
          </div>
          <p className="font-body text-xs text-[--text-secondary] mt-3 leading-relaxed">
            {t('pr_topCompDesc')}
          </p>
        </Card>
      </div>
    </section>
  )
}
