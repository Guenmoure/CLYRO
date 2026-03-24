'use client'

import { useState } from 'react'
import { useCredits } from '@/hooks/use-credits'
import { createStripeCheckout, createMonerooCheckout } from '@/lib/api'
import { toast } from '@/components/ui/toast'

export default function BillingPage() {
  const { credits, plan, loading } = useCredits()
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [phone, setPhone] = useState('')
  const [showMobileMoneyModal, setShowMobileMoneyModal] = useState<'starter' | 'studio' | null>(null)

  const PLANS = [
    {
      id: 'starter' as const,
      name: 'Starter',
      price: '19€',
      period: '/mois',
      credits: '30 vidéos/mois',
      features: ['6 styles Faceless Videos', '2 voix clonées', 'Export MP4 HD'],
    },
    {
      id: 'studio' as const,
      name: 'Studio',
      price: '49€',
      period: '/mois',
      credits: 'Vidéos illimitées',
      features: ['Motion Graphics inclus', 'Voix clonées illimitées', 'SSO Entreprise'],
    },
  ]

  async function handleStripeCheckout(targetPlan: 'starter' | 'studio') {
    setLoadingPlan(`stripe-${targetPlan}`)
    try {
      const { checkout_url } = await createStripeCheckout({ plan: targetPlan })
      if (checkout_url) window.location.href = checkout_url
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur Stripe')
    } finally {
      setLoadingPlan(null)
    }
  }

  async function handleMonerooCheckout(targetPlan: 'starter' | 'studio') {
    if (!phone.trim()) {
      toast.error('Saisis ton numéro de téléphone Mobile Money.')
      return
    }

    setLoadingPlan(`moneroo-${targetPlan}`)
    try {
      const { payment_url } = await createMonerooCheckout({
        plan: targetPlan,
        phone,
        currency: 'XOF',
      })
      if (payment_url) window.location.href = payment_url
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur Moneroo')
    } finally {
      setLoadingPlan(null)
      setShowMobileMoneyModal(null)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <p className="label-mono mb-1">Abonnement</p>
        <h1 className="font-display text-2xl font-bold text-foreground">Facturation & Plan</h1>
      </div>

      {/* Plan actuel */}
      <div className="bg-navy-900 border border-border rounded-xl p-6">
        <h2 className="font-display font-semibold text-foreground mb-4">Plan actuel</h2>
        {loading ? (
          <div className="h-8 bg-navy-800 rounded animate-pulse w-1/3" />
        ) : (
          <div className="flex items-center gap-4">
            <span className="font-mono text-xs uppercase tracking-widest text-clyro-purple bg-clyro-purple/10 border border-clyro-purple/20 px-3 py-1.5 rounded-full">
              {plan}
            </span>
            <span className="font-body text-muted-foreground text-sm">
              {plan === 'studio'
                ? 'Vidéos illimitées'
                : `${credits} crédit${credits > 1 ? 's' : ''} restant${credits > 1 ? 's' : ''}`}
            </span>
          </div>
        )}
      </div>

      {/* Plans disponibles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {PLANS.map((p) => {
          const isCurrent = plan === p.id
          return (
            <div
              key={p.id}
              className={`bg-navy-900 border rounded-xl p-6 ${
                isCurrent ? 'border-clyro-blue/40' : 'border-border'
              }`}
            >
              {isCurrent && (
                <span className="font-mono text-xs text-clyro-blue uppercase tracking-widest bg-clyro-blue/10 border border-clyro-blue/20 px-2 py-1 rounded-full mb-3 inline-block">
                  Plan actuel
                </span>
              )}
              <div className="flex items-baseline gap-1 mb-1">
                <span className="font-display text-3xl font-bold text-foreground">{p.price}</span>
                <span className="text-muted-foreground font-body text-sm">{p.period}</span>
              </div>
              <p className="font-display font-semibold text-lg text-foreground mb-1">{p.name}</p>
              <p className="font-mono text-xs text-clyro-blue mb-4">{p.credits}</p>

              <ul className="space-y-2 mb-6">
                {p.features.map((f) => (
                  <li key={f} className="text-sm font-body text-muted-foreground flex items-center gap-2">
                    <span className="text-clyro-blue">✓</span> {f}
                  </li>
                ))}
              </ul>

              {!isCurrent && (
                <div className="space-y-2">
                  {/* Stripe */}
                  <button
                    onClick={() => handleStripeCheckout(p.id)}
                    disabled={!!loadingPlan}
                    className="w-full bg-grad-primary text-white font-display font-semibold py-2.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 text-sm"
                  >
                    {loadingPlan === `stripe-${p.id}` ? 'Redirection...' : 'Payer par carte'}
                  </button>

                  {/* Mobile Money */}
                  <button
                    onClick={() => setShowMobileMoneyModal(p.id)}
                    disabled={!!loadingPlan}
                    className="w-full bg-navy-800 border border-border text-foreground font-display font-semibold py-2.5 rounded-xl hover:bg-navy-700 transition-colors text-sm disabled:opacity-50"
                  >
                    📱 Mobile Money (Afrique)
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal Mobile Money */}
      {showMobileMoneyModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-navy-900 border border-border rounded-2xl p-6 w-full max-w-md">
            <h3 className="font-display text-lg font-semibold text-foreground mb-4">
              Payer avec Mobile Money
            </h3>
            <p className="text-muted-foreground text-sm font-body mb-4">
              Orange Money, Wave, MTN, Moov — saisis ton numéro au format international.
            </p>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+225 07 00 00 00 00"
              className="w-full bg-navy-800 border border-border rounded-xl px-4 py-3 text-foreground font-body text-sm placeholder:text-muted-foreground focus:outline-none focus:border-clyro-blue mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowMobileMoneyModal(null)}
                className="flex-1 bg-navy-800 border border-border text-foreground font-display font-semibold py-2.5 rounded-xl hover:bg-navy-700 text-sm"
              >
                Annuler
              </button>
              <button
                onClick={() => handleMonerooCheckout(showMobileMoneyModal)}
                disabled={!!loadingPlan}
                className="flex-1 bg-grad-primary text-white font-display font-semibold py-2.5 rounded-xl hover:opacity-90 disabled:opacity-50 text-sm"
              >
                {loadingPlan ? 'Traitement...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
