'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Smartphone } from 'lucide-react'
import { useCredits } from '@/hooks/use-credits'
import { useLanguage } from '@/lib/i18n'
import { createStripeCheckout, createMonerooCheckout } from '@/lib/api'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

export default function BillingPage() {
  const { credits, plan, loading } = useCredits()
  const { t } = useLanguage()
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [phone, setPhone] = useState('')
  const [showMobileMoneyModal, setShowMobileMoneyModal] = useState<'starter' | 'studio' | null>(null)

  const closeModal = useCallback(() => setShowMobileMoneyModal(null), [])

  // Dismiss modal on Escape
  useEffect(() => {
    if (!showMobileMoneyModal) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') closeModal() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [showMobileMoneyModal, closeModal])

  const PLANS = [
    {
      id: 'starter' as const,
      name: 'Starter',
      price: '19€',
      credits: t('bill_starterCredits'),
      features: [t('bill_feat_styles'), t('bill_feat_voices'), t('bill_feat_export')],
      color: 'border-border',
      accent: 'text-primary',
    },
    {
      id: 'studio' as const,
      name: 'Studio',
      price: '49€',
      credits: t('bill_studioCredits'),
      features: [t('bill_feat_motion'), t('bill_feat_voicesUnlimited'), t('bill_feat_sso')],
      color: 'border-brand/30',
      accent: 'text-primary',
    },
  ]

  async function handleStripeCheckout(targetPlan: 'starter' | 'studio') {
    setLoadingPlan(`stripe-${targetPlan}`)
    try {
      const { checkout_url } = await createStripeCheckout({ plan: targetPlan })
      if (checkout_url) window.location.href = checkout_url
    } catch { toast.error(t('bill_stripeError')) }
    finally { setLoadingPlan(null) }
  }

  async function handleMonerooCheckout(targetPlan: 'starter' | 'studio') {
    if (!phone.trim()) { toast.error(t('bill_enterPhone')); return }
    setLoadingPlan(`moneroo-${targetPlan}`)
    try {
      const { payment_url } = await createMonerooCheckout({ plan: targetPlan, phone, currency: 'XOF' })
      if (payment_url) window.location.href = payment_url
    } catch { toast.error(t('bill_monerooError')) }
    finally { setLoadingPlan(null); setShowMobileMoneyModal(null) }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-3xl mx-auto">
      <div className="space-y-6 animate-fade-in">

        <div className="flex items-center gap-3">
          <Link href="/settings" className="w-8 h-8 rounded-lg bg-muted hover:bg-muted/80 border border-border flex items-center justify-center text-[--text-muted] hover:text-foreground transition-colors duration-200">
            <ArrowLeft size={15} />
          </Link>
          <div>
            <p className="font-mono text-xs text-[--text-muted] uppercase tracking-widest">{t('bill_settings')}</p>
            <h1 className="font-display text-2xl font-bold text-foreground">{t('bill_billing')}</h1>
          </div>
        </div>

        {/* Current plan */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="font-display font-semibold text-foreground mb-4">{t('bill_currentPlan')}</h2>
          {loading ? (
            <div className="h-8 bg-muted rounded animate-pulse w-1/3" />
          ) : (
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs uppercase tracking-widest text-primary bg-brand/10 border border-brand/20 px-3 py-1.5 rounded-full">
                {plan}
              </span>
              <span className="font-body text-[--text-secondary] text-sm">
                {plan === 'studio' ? t('bill_unlimitedVideos') : `${credits} ${t('bill_creditsRemaining')}`}
              </span>
            </div>
          )}
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {PLANS.map((p) => {
            const isCurrent = plan === p.id
            return (
              <div key={p.id} className={cn('bg-card border border-border rounded-2xl p-6 transition-all', p.color, isCurrent && 'ring-2 ring-brand/25')}>
                {isCurrent && (
                  <span className="font-mono text-xs text-primary uppercase tracking-widest bg-brand/10 border border-brand/20 px-2 py-1 rounded-full mb-4 inline-block">
                    {t('bill_currentPlanBadge')}
                  </span>
                )}
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="font-display text-3xl font-bold text-foreground">{p.price}</span>
                  <span className="text-[--text-muted] font-body text-sm">{t('bill_perMonth')}</span>
                </div>
                <p className="font-display font-semibold text-lg text-foreground mb-1">{p.name}</p>
                <p className={cn('font-mono text-xs mb-4', p.accent)}>{p.credits}</p>

                <ul className="space-y-2 mb-6">
                  {p.features.map((f) => (
                    <li key={f} className="text-sm font-body text-[--text-secondary] flex items-center gap-2">
                      <Check size={14} className="text-primary shrink-0" /> {f}
                    </li>
                  ))}
                </ul>

                {!isCurrent && (
                  <div className="space-y-2">
                    <button onClick={() => handleStripeCheckout(p.id)} disabled={!!loadingPlan}
                      className="w-full bg-grad-primary text-white font-display font-semibold py-2.5 rounded-xl hover:opacity-90 disabled:opacity-50 text-sm transition-opacity">
                      {loadingPlan === `stripe-${p.id}` ? t('bill_redirecting') : t('bill_payByCard')}
                    </button>
                    <button onClick={() => setShowMobileMoneyModal(p.id)} disabled={!!loadingPlan}
                      className="w-full bg-muted hover:bg-muted/80 border border-border text-[--text-secondary] font-display font-semibold py-2.5 rounded-xl text-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                      <Smartphone size={14} /> {t('bill_mobileMoney')}
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
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-glow-brand">
            <h3 className="font-display text-lg font-semibold text-foreground mb-1">{t('bill_payWithMobileMoney')}</h3>
            <p className="text-[--text-secondary] text-sm font-body mb-4">{t('bill_mobileMoneyDesc')}</p>
            <label htmlFor="moneroo-phone" className="sr-only">{t('bill_mobileMoneyLabel')}</label>
            <input
              id="moneroo-phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+225 07 00 00 00 00"
              className="w-full rounded-xl border border-border bg-input px-4 py-3 text-foreground font-body text-sm placeholder:text-[--text-muted] focus:outline-none focus:border-primary transition-all mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => setShowMobileMoneyModal(null)}
                className="flex-1 bg-muted hover:bg-muted/80 border border-border text-[--text-secondary] font-display font-semibold py-2.5 rounded-xl text-sm transition-all">
                {t('bill_cancel')}
              </button>
              <button onClick={() => handleMonerooCheckout(showMobileMoneyModal)} disabled={!!loadingPlan}
                className="flex-1 bg-grad-primary text-white font-display font-semibold py-2.5 rounded-xl hover:opacity-90 disabled:opacity-50 text-sm">
                {loadingPlan ? t('bill_processing') : t('bill_confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
