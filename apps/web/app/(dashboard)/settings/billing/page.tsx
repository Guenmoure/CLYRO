'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Smartphone } from 'lucide-react'
import { useCredits } from '@/hooks/use-credits'
import { createStripeCheckout, createMonerooCheckout } from '@/lib/api'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

const PLANS = [
  {
    id: 'starter' as const,
    name: 'Starter',
    price: '19€',
    period: '/mois',
    credits: '30 vidéos/mois',
    features: ['6 styles Faceless Videos', '2 voix clonées', 'Export MP4 HD'],
    color: 'border-brand-border',
    accent: 'text-brand-primary',
  },
  {
    id: 'studio' as const,
    name: 'Studio',
    price: '49€',
    period: '/mois',
    credits: 'Vidéos illimitées',
    features: ['Motion Graphics inclus', 'Voix clonées illimitées', 'SSO Entreprise'],
    color: 'border-brand-secondary/40',
    accent: 'text-brand-secondary',
  },
]

export default function BillingPage() {
  const { credits, plan, loading } = useCredits()
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [phone, setPhone] = useState('')
  const [showMobileMoneyModal, setShowMobileMoneyModal] = useState<'starter' | 'studio' | null>(null)

  async function handleStripeCheckout(targetPlan: 'starter' | 'studio') {
    setLoadingPlan(`stripe-${targetPlan}`)
    try {
      const { checkout_url } = await createStripeCheckout({ plan: targetPlan })
      if (checkout_url) window.location.href = checkout_url
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Erreur Stripe') }
    finally { setLoadingPlan(null) }
  }

  async function handleMonerooCheckout(targetPlan: 'starter' | 'studio') {
    if (!phone.trim()) { toast.error('Saisis ton numéro de téléphone Mobile Money.'); return }
    setLoadingPlan(`moneroo-${targetPlan}`)
    try {
      const { payment_url } = await createMonerooCheckout({ plan: targetPlan, phone, currency: 'XOF' })
      if (payment_url) window.location.href = payment_url
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Erreur Moneroo') }
    finally { setLoadingPlan(null); setShowMobileMoneyModal(null) }
  }

  return (
    <div className="flex-1 overflow-y-auto px-8 py-8">
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">

        <div className="flex items-center gap-3">
          <Link href="/settings" className="w-8 h-8 rounded-lg bg-brand-bg border border-brand-border flex items-center justify-center text-brand-muted hover:text-brand-text hover:border-brand-primary/40 transition-all">
            <ArrowLeft size={15} />
          </Link>
          <div>
            <p className="font-mono text-xs text-brand-muted uppercase tracking-widest">Settings</p>
            <h1 className="font-display text-2xl font-bold text-brand-text">Billing</h1>
          </div>
        </div>

        {/* Current plan */}
        <div className="bg-brand-surface border border-brand-border rounded-2xl p-6">
          <h2 className="font-display font-semibold text-brand-text mb-4">Plan actuel</h2>
          {loading ? (
            <div className="h-8 bg-brand-bg rounded animate-pulse w-1/3" />
          ) : (
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs uppercase tracking-widest text-brand-secondary bg-brand-secondary/10 border border-brand-secondary/20 px-3 py-1.5 rounded-full">
                {plan}
              </span>
              <span className="font-body text-brand-muted text-sm">
                {plan === 'studio' ? 'Vidéos illimitées' : `${credits} crédit${credits > 1 ? 's' : ''} restant${credits > 1 ? 's' : ''}`}
              </span>
            </div>
          )}
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {PLANS.map((p) => {
            const isCurrent = plan === p.id
            return (
              <div key={p.id} className={cn('bg-brand-surface border rounded-2xl p-6 transition-all', p.color, isCurrent && 'ring-2 ring-brand-primary/20')}>
                {isCurrent && (
                  <span className="font-mono text-xs text-brand-primary uppercase tracking-widest bg-brand-primary-light border border-brand-primary/20 px-2 py-1 rounded-full mb-4 inline-block">
                    Plan actuel
                  </span>
                )}
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="font-display text-3xl font-bold text-brand-text">{p.price}</span>
                  <span className="text-brand-muted font-body text-sm">{p.period}</span>
                </div>
                <p className="font-display font-semibold text-lg text-brand-text mb-1">{p.name}</p>
                <p className={cn('font-mono text-xs mb-4', p.accent)}>{p.credits}</p>

                <ul className="space-y-2 mb-6">
                  {p.features.map((f) => (
                    <li key={f} className="text-sm font-body text-brand-muted flex items-center gap-2">
                      <Check size={14} className="text-brand-primary shrink-0" /> {f}
                    </li>
                  ))}
                </ul>

                {!isCurrent && (
                  <div className="space-y-2">
                    <button onClick={() => handleStripeCheckout(p.id)} disabled={!!loadingPlan}
                      className="w-full bg-grad-primary text-white font-display font-semibold py-2.5 rounded-xl hover:opacity-90 disabled:opacity-50 text-sm transition-opacity">
                      {loadingPlan === `stripe-${p.id}` ? 'Redirection…' : 'Payer par carte'}
                    </button>
                    <button onClick={() => setShowMobileMoneyModal(p.id)} disabled={!!loadingPlan}
                      className="w-full bg-brand-bg border border-brand-border text-brand-text font-display font-semibold py-2.5 rounded-xl hover:border-brand-primary/40 text-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                      <Smartphone size={14} /> Mobile Money (Afrique)
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Mobile Money modal */}
      {showMobileMoneyModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-brand-surface border border-brand-border rounded-2xl p-6 w-full max-w-md shadow-brand-lg">
            <h3 className="font-display text-lg font-semibold text-brand-text mb-1">Payer avec Mobile Money</h3>
            <p className="text-brand-muted text-sm font-body mb-4">Orange Money, Wave, MTN, Moov — format international.</p>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+225 07 00 00 00 00"
              className="w-full bg-brand-bg border border-brand-border rounded-xl px-4 py-3 text-brand-text font-body text-sm placeholder:text-brand-muted focus:outline-none focus:border-brand-primary mb-4" />
            <div className="flex gap-3">
              <button onClick={() => setShowMobileMoneyModal(null)}
                className="flex-1 bg-brand-bg border border-brand-border text-brand-text font-display font-semibold py-2.5 rounded-xl text-sm">
                Annuler
              </button>
              <button onClick={() => handleMonerooCheckout(showMobileMoneyModal)} disabled={!!loadingPlan}
                className="flex-1 bg-grad-primary text-white font-display font-semibold py-2.5 rounded-xl hover:opacity-90 disabled:opacity-50 text-sm">
                {loadingPlan ? 'Traitement…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
