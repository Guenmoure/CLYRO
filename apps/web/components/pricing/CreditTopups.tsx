'use client'

import Link from 'next/link'
import {
  Shield, RefreshCw, CreditCard, Smartphone,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatNumber } from './pricing-data'

interface Topup {
  id: string
  name: string
  credits: number
  priceEur: number
  perCreditEur: number
  headBadge?: React.ReactNode
  badge: React.ReactNode
  equivalents: string[]
  variant: 'default' | 'elevated' | 'gradient'
  primary?: boolean
}

const TOPUPS: Topup[] = [
  {
    id: 'boost',
    name: 'Boost',
    credits: 500,
    priceEur: 8,
    perCreditEur: 0.016,
    badge: <Badge variant="neutral">Perfect pour essayer</Badge>,
    equivalents: ['≈ 4 vidéos Fast 5min', 'ou 6 vidéos Storyboard 10min'],
    variant: 'elevated',
  },
  {
    id: 'pro-boost',
    name: 'Pro Boost',
    credits: 1500,
    priceEur: 20,
    perCreditEur: 0.013,
    badge: <Badge variant="info">Bon rapport</Badge>,
    equivalents: ['≈ 12 vidéos Fast 5min', 'ou 1 vidéo Pro 15min + reste'],
    variant: 'elevated',
  },
  {
    id: 'power',
    name: 'Power',
    credits: 5000,
    priceEur: 55,
    perCreditEur: 0.011,
    headBadge: <Badge variant="purple">Le plus choisi</Badge>,
    badge: <Badge variant="purple">Meilleure valeur</Badge>,
    equivalents: ['≈ 41 vidéos Fast 5min', 'ou 4 vidéos Pro 15min'],
    variant: 'gradient',
    primary: true,
  },
  {
    id: 'studio',
    name: 'Studio',
    credits: 15000,
    priceEur: 130,
    perCreditEur: 0.0087,
    badge: <Badge variant="success">Volume</Badge>,
    equivalents: ['≈ 125 vidéos Fast 5min', 'ou 12 vidéos Pro 15min'],
    variant: 'elevated',
  },
]

export function CreditTopups() {
  return (
    <section className="bg-muted/30 px-6 py-20">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10 space-y-3">
          <div className="flex justify-center">
            <Badge variant="neutral">Top-ups</Badge>
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground">
            Besoin de plus de crédits ?
          </h2>
          <p className="font-body text-[--text-secondary] max-w-2xl mx-auto">
            Achète des crédits supplémentaires à tout moment. Disponibles pour tous les abonnés payants.
            Les crédits n&apos;expirent jamais.
          </p>
        </div>

        {/* 4 top-up cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {TOPUPS.map((t) => (
            <div key={t.id} className="relative">
              {t.headBadge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  {t.headBadge}
                </div>
              )}
              <Card
                variant={t.variant}
                padding="md"
                hoverable
                className={cn(
                  'h-full flex flex-col',
                  t.primary && 'border-2 border-blue-500/50 shadow-[0_0_30px_-8px_rgba(59,142,240,0.3)]',
                )}
              >
                {/* Credits (large) */}
                <p className="font-display text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                  {formatNumber(t.credits)}
                </p>
                <p className="font-body text-xs text-[--text-secondary] -mt-1">crédits</p>

                {/* Price */}
                <div className="mt-4">
                  <p className="font-display text-xl font-bold text-foreground">{t.priceEur}€</p>
                  <p className="font-mono text-[10px] text-[--text-muted]">
                    {t.perCreditEur.toFixed(t.perCreditEur < 0.01 ? 4 : 3)}€ / crédit
                  </p>
                </div>

                {/* Badge */}
                <div className="mt-3">{t.badge}</div>

                {/* Equivalents */}
                <ul className="mt-3 space-y-1 flex-1">
                  {t.equivalents.map((e) => (
                    <li key={e} className="font-body text-[11px] text-[--text-secondary] leading-relaxed">
                      {e}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <div className="mt-4">
                  <Button
                    variant={t.primary ? 'primary' : 'secondary'}
                    size="sm"
                    fullWidth
                    asChild
                  >
                    <Link href="/settings?tab=billing&topup=true">Ajouter</Link>
                  </Button>
                </div>
              </Card>
            </div>
          ))}
        </div>

        {/* Reassurance row */}
        <div className="flex items-center justify-center flex-wrap gap-x-6 gap-y-2 mt-10 font-mono text-xs text-[--text-secondary]">
          <span className="inline-flex items-center gap-1.5">
            <Shield size={13} className="text-success" />
            Crédits sans expiration
          </span>
          <span className="inline-flex items-center gap-1.5">
            <RefreshCw size={13} className="text-blue-400" />
            S&apos;ajoutent à votre solde existant
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CreditCard size={13} className="text-purple-400" />
            Paiement sécurisé via Stripe
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Smartphone size={13} className="text-amber-400" />
            Mobile Money (Studio)
          </span>
        </div>

        {/* Comparison card */}
        <Card variant="glass" padding="lg" className="mt-10 max-w-lg mx-auto text-center">
          <p className="font-body text-sm text-foreground">
            Les crédits d&apos;abonnement sont toujours moins chers que les top-ups.
          </p>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="rounded-xl border border-border bg-muted/40 px-3 py-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[--text-muted]">Abonnement Creator</p>
              <p className="font-display text-lg font-bold text-foreground mt-1">0,011€ / crédit</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/40 px-3 py-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[--text-muted]">Top-up Power</p>
              <p className="font-display text-lg font-bold text-foreground mt-1">0,011€ / crédit</p>
            </div>
          </div>
          <div className="mt-4 flex justify-center">
            <Badge variant="success">Même prix au même niveau</Badge>
          </div>
          <p className="font-body text-xs text-[--text-secondary] mt-3 leading-relaxed">
            Les top-ups grandes quantités offrent le même tarif que l&apos;abonnement Creator.
            Parfait pour les périodes de production intensive.
          </p>
        </Card>
      </div>
    </section>
  )
}
