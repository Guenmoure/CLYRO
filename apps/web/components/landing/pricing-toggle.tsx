'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const PLANS = {
  starter: {
    name: 'Starter',
    monthly: 0,
    annual: 0,
    desc: 'Pour découvrir CLYRO sans engagement',
    features: [
      '3 vidéos Faceless / mois',
      '3 vidéos Motion Design / mois',
      'Brand Kit non disponible',
      'Watermark CLYRO',
      'Export 720p',
      'Stockage 7 jours',
    ],
    cta: 'Commencer gratuitement',
    ctaVariant: 'secondary' as const,
    ctaHref: '/signup',
    popular: false,
  },
  pro: {
    name: 'Pro',
    monthly: 19,
    annual: 15,
    desc: 'Pour les créateurs qui veulent scaler',
    features: [
      'Faceless Videos illimitées',
      'Motion Design illimité',
      'Brand Kit — 5 identités / mois',
      'Sans watermark',
      'Export 1080p + 4K',
      'Stockage 90 jours',
      'Bibliothèque de styles Pro',
      '2 voix clonées',
    ],
    cta: "Commencer l'essai Pro",
    ctaVariant: 'primary' as const,
    ctaHref: '/signup?plan=pro',
    popular: true,
  },
  enterprise: {
    name: 'Entreprise',
    monthly: 79,
    annual: 63,
    desc: 'Pour les agences et équipes créatives',
    features: [
      'Tout le plan Pro',
      'Brand Kit illimité',
      'Voix clonées illimitées',
      'Brand kit partageable (équipe)',
      'Rendu prioritaire',
      'Stockage permanent',
      'API access',
      'Support prioritaire',
    ],
    cta: "Contacter l'équipe",
    ctaVariant: 'secondary' as const,
    ctaHref: '/contact',
    popular: false,
  },
}

export function PricingToggle() {
  const [annual, setAnnual] = useState(false)

  return (
    <div>
      {/* Toggle */}
      <div className="flex items-center justify-center gap-3 mb-10">
        <span className={cn('font-body text-sm', !annual ? 'text-foreground' : 'text-[--text-muted]')}>
          Mensuel
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={annual}
          onClick={() => setAnnual(!annual)}
          className={cn(
            'relative w-11 h-6 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50',
            annual ? 'bg-blue-500' : 'bg-border'
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200',
              annual && 'translate-x-5'
            )}
          />
        </button>
        <span className={cn('font-body text-sm flex items-center gap-2', annual ? 'text-foreground' : 'text-[--text-muted]')}>
          Annuel
          <Badge variant="success">−20%</Badge>
        </span>
      </div>

      {/* Plans grid */}
      <div className="grid md:grid-cols-3 gap-6 items-start">
        {Object.entries(PLANS).map(([key, plan]) => (
          <div key={key} className="relative">
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                <Badge variant="purple">Le plus populaire</Badge>
              </div>
            )}
            <Card
              variant={plan.popular ? 'gradient' : 'default'}
              padding="lg"
              className={cn(plan.popular && 'border-blue-500/30')}
            >
              <div className="mb-6">
                <h3 className={cn(
                  'font-display text-xl font-semibold mb-1',
                  plan.popular && 'gradient-text'
                )}>
                  {plan.name}
                </h3>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="font-display text-3xl font-bold text-foreground">
                    {annual ? plan.annual : plan.monthly}€
                  </span>
                  <span className="font-body text-sm text-[--text-muted]">/mois</span>
                </div>
                <p className="font-body text-sm text-[--text-secondary]">{plan.desc}</p>
              </div>

              <div className="border-t border-border/50 pt-6 mb-6 flex flex-col gap-3">
                {plan.features.map((f) => (
                  <div key={f} className="flex items-start gap-2.5">
                    <Check size={14} className="text-success shrink-0 mt-0.5" />
                    <span className="font-body text-sm text-[--text-secondary]">{f}</span>
                  </div>
                ))}
              </div>

              <Link href={plan.ctaHref}>
                <Button variant={plan.ctaVariant} fullWidth>
                  {plan.cta}
                </Button>
              </Link>
            </Card>
          </div>
        ))}
      </div>

      <p className="font-mono text-xs text-[--text-muted] text-center mt-6">
        ✓ Sans carte bancaire pour le Starter · ✓ Annulation à tout moment · ✓ Paiement par carte ou Mobile Money (Orange Money, Wave, MTN)
      </p>
    </div>
  )
}
