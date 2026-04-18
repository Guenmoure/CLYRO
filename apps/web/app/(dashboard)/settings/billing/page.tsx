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
    color: 'border-white/[0.06]',
    accent: 'text-clyro-accent',
  },
  {
    id: 'studio' as const,
    name: 'Studio',
    price: '49€',
    period: '/mois',
    credits: 'Vidéos illimitées',
    features: ['Motion Graphics inclus', 'Voix clonées illimitées', 'SSO Entreprise'],
    color: 'border-clyro-primary/30',
    accent: 'text-clyro-primary',
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
          <Link href="/settings" className="w-8 h-8 rounded-lg glass glass-hover flex items-center justify-center text-gray-400 dark:text-white/40 hover:text-gray-900 dark:hover:text-white transition-colors duration-200">
            <ArrowLeft size={15} />
          </Link>
          <div>
            <p className="font-mono text-xs text-gray-400 dark:text-white/40 uppercase tracking-widest">Settings</p>
            <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white">Billing</h1>
          </div>
        </div>

        {/* Current plan */}
        <div className="glass glass-heavy rounded-2xl p-6">
          <h2 className="font-display font-semibold text-gray-900 dark:text-white mb-4">Plan actuel</h2>
          {loading ? (
            <div className="h-8 bg-gray-100 dark:bg-white/5 rounded animate-pulse w-1/3" />
          ) : (
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs uppercase tracking-widest text-clyro-primary bg-clyro-primary/10 border border-clyro-primary/20 px-3 py-1.5 rounded-full">
                {plan}
              </span>
              <span className="font-body text-gray-500 dark:text-white/50 text-sm">
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
              <div key={p.id} className={cn('glass glass-heavy border rounded-2xl p-6 transition-all', p.color, isCurrent && 'ring-2 ring-clyro-primary/25')}>
                {isCurrent && (
                  <span className="font-mono text-xs text-clyro-primary uppercase tracking-widest bg-clyro-primary/10 border border-clyro-primary/20 px-2 py-1 rounded-full mb-4 inline-block">
                    Plan actuel
                  </span>
                )}
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="font-display text-3xl font-bold text-gray-900 dark:text-white">{p.price}</span>
                  <span className="text-gray-400 dark:text-white/40 font-body text-sm">{p.period}</span>
                </div>
                <p className="font-display font-semibold text-lg text-gray-900 dark:text-white mb-1">{p.name}</p>
                <p className={cn('font-mono text-xs mb-4', p.accent)}>{p.credits}</p>

                <ul className="space-y-2 mb-6">
                  {p.features.map((f) => (
                    <li key={f} className="text-sm font-body text-gray-600 dark:text-white/60 flex items-center gap-2">
                      <Check size={14} className="text-clyro-primary shrink-0" /> {f}
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
                      className="w-full glass glass-hover text-gray-600 dark:text-white/70 font-display font-semibold py-2.5 rounded-xl text-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2">
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass glass-heavy rounded-2xl p-6 w-full max-w-md shadow-glow-primary">
            <h3 className="font-display text-lg font-semibold text-gray-900 dark:text-white mb-1">Payer avec Mobile Money</h3>
            <p className="text-gray-500 dark:text-white/50 text-sm font-body mb-4">Orange Money, Wave, MTN, Moov — format international.</p>
            <label htmlFor="moneroo-phone" className="sr-only">Numéro Mobile Money</label>
            <input
              id="moneroo-phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+225 07 00 00 00 00"
              className="w-full glass rounded-xl px-4 py-3 text-gray-700 dark:text-white/80 font-body text-sm placeholder:text-gray-400 dark:placeholder:text-white/25 focus:outline-none focus:border-clyro-primary/50 transition-all mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => setShowMobileMoneyModal(null)}
                className="flex-1 glass glass-hover text-gray-500 dark:text-white/60 font-display font-semibold py-2.5 rounded-xl text-sm transition-all">
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
