'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Loader2, Zap, Package } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'

interface Plan {
  plan: 'free' | 'starter' | 'pro' | 'studio'
  credits: number
}

const PLAN_META: Record<Plan['plan'], { label: string; price: string; color: string }> = {
  free:    { label: 'Free',    price: '0€',     color: 'from-gray-400/20 to-gray-200/10' },
  starter: { label: 'Starter', price: '9€/mo',  color: 'from-amber-400/30 to-amber-200/10' },
  pro:     { label: 'Pro',     price: '19€/mo', color: 'from-blue-500/30 to-purple-500/20' },
  studio:  { label: 'Studio',  price: '49€/mo', color: 'from-purple-500/30 to-pink-500/20' },
}

export function PlanBillingSection() {
  const supabase = createBrowserClient()
  const [loading, setLoading] = useState(true)
  const [plan, setPlan]       = useState<Plan>({ plan: 'free', credits: 0 })

  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) return
        const { data } = await supabase
          .from('profiles')
          .select('plan, credits')
          .eq('id', session.user.id)
          .maybeSingle()
        if (data) setPlan({ plan: (data.plan ?? 'free') as Plan['plan'], credits: data.credits ?? 0 })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supabase])

  const meta = PLAN_META[plan.plan]
  const isPaid = plan.plan === 'pro' || plan.plan === 'studio'

  if (loading) {
    return <div className="py-20 flex items-center justify-center"><Loader2 className="animate-spin text-[--text-muted]" /></div>
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground">Plan & Billing</h2>
        <p className="font-body text-sm text-[--text-secondary] mt-1">
          Manage your subscription, credits, and payment methods.
        </p>
      </div>

      {/* Current plan card */}
      <section className="space-y-3">
        <p className="font-body text-sm font-semibold text-foreground">Your plan</p>
        <div className={cn('relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br', meta.color)}>
          <div className="relative p-6 flex items-center justify-between gap-4 bg-card/70 backdrop-blur-sm">
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-baseline gap-3">
                <h3 className="font-display text-3xl font-bold text-foreground">{meta.label}</h3>
                <span className="font-mono text-sm text-[--text-secondary]">{meta.price}</span>
              </div>
              <p className="font-body text-sm text-[--text-secondary] max-w-md">
                {isPaid
                  ? 'Unlimited generation, 1080p HD export, long videos up to 5 minutes.'
                  : 'Upgrade to Pro to generate unlimited, export in 1080p and create videos up to 5 minutes.'}
              </p>
              <div className="inline-flex items-center gap-2 rounded-full bg-background/60 px-3 py-1 text-xs font-mono text-foreground">
                <Zap size={11} className="text-warning" />
                {plan.credits} credit{plan.credits !== 1 ? 's' : ''} left
              </div>
            </div>
            {!isPaid && (
              <Link
                href="/pricing"
                className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-foreground text-background px-5 py-2.5 text-sm font-display font-semibold hover:opacity-90 transition-opacity shadow-sm"
              >
                <Zap size={13} /> Upgrade
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Add-ons */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-body text-sm font-semibold text-foreground">Add-ons</p>
          <button
            type="button"
            disabled
            title="Coming soon"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-1.5 text-xs font-body font-medium text-[--text-secondary] hover:bg-muted transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Buy an add-on
          </button>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6">
          <Package size={18} className="text-[--text-muted] shrink-0" />
          <p className="font-body text-sm text-[--text-secondary]">No active add-ons.</p>
        </div>
      </section>

      {/* Billing history (stub) */}
      <section className="space-y-3">
        <p className="font-body text-sm font-semibold text-foreground">Billing history</p>
        <div className="rounded-xl border border-border bg-card px-4 py-8 text-center">
          <p className="font-body text-sm text-[--text-secondary]">No invoices yet.</p>
        </div>
      </section>

      {/* See full pricing */}
      <Link
        href="/pricing"
        className="inline-flex items-center gap-2 font-body text-sm text-blue-500 hover:text-blue-600 transition-colors"
      >
        See all plans & pricing
        <ArrowRight size={13} />
      </Link>
    </div>
  )
}
