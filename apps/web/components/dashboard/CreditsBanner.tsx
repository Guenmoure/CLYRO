'use client'

import Link from 'next/link'
import { Zap, ArrowRight, ShoppingCart } from 'lucide-react'
import { PLAN_MONTHLY_CREDITS, type PlanId, CREDIT_COST_PER_MIN } from '@clyro/shared'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n'

// ── Helpers ────────────────────────────────────────────────────────────────────

const KNOWN_PLANS = new Set<PlanId>(['free', 'starter', 'pro', 'creator', 'studio'])

/**
 * Derive a plan's monthly quota from the shared constants — single
 * source of truth aligned with /pricing and the DB column.
 * Falls back to Free quota for unknown / legacy plan strings so the
 * progress bar still renders meaningfully.
 */
export function getPlanTotal(plan: string): number {
  const normalized = plan.toLowerCase() as PlanId
  return KNOWN_PLANS.has(normalized) ? PLAN_MONTHLY_CREDITS[normalized] : PLAN_MONTHLY_CREDITS.free
}

// ── Component ──────────────────────────────────────────────────────────────────

interface CreditsBannerProps {
  plan:         string
  creditsLeft:  number
  creditsTotal?: number  // optional — inferred from plan if omitted
}

export function CreditsBanner({ plan, creditsLeft, creditsTotal: propTotal }: CreditsBannerProps) {
  const { t } = useLanguage()
  const creditsTotal = propTotal ?? getPlanTotal(plan)
  const creditsUsed  = Math.max(0, creditsTotal - creditsLeft)

  // Contextual label — makes the abstract credit number feel tangible.
  // Numbers reflect "how many ~1-minute videos can I still make in this
  // mode", computed from the shared per-minute cost map (storyboard=5,
  // fast=25, pro=80).
  const canDoFast       = Math.floor(creditsLeft / CREDIT_COST_PER_MIN.fast)
  const canDoStoryboard = Math.floor(creditsLeft / CREDIT_COST_PER_MIN.storyboard)

  const isEmpty = creditsLeft <= 0
  const isLow   = !isEmpty && creditsLeft < 50
  const percentUsed = creditsTotal > 0
    ? Math.min(100, Math.round((creditsUsed / creditsTotal) * 100))
    : 0

  const isStarter = ['free', 'starter'].includes(plan.toLowerCase())

  const contextLabel = isEmpty
    ? t('cb_no_credits')
    : isLow
    ? `~${canDoStoryboard} ${t('cb_storyboard')}${canDoStoryboard !== 1 ? 's' : ''} remaining`
    : `~${canDoFast} ${t('cb_fast_video')}${canDoFast !== 1 ? 's' : ''} or ~${canDoStoryboard} ${t('cb_storyboard')}`

  return (
    <div className={cn(
      'flex items-center justify-between gap-4 px-4 py-3 rounded-xl border',
      isEmpty ? 'bg-error/5 border-error/20'
      : isLow ? 'bg-amber-500/5 border-amber-500/20'
              : 'bg-card border-border/60',
    )}>
      {/* Left — icon + credits */}
      <div className="flex items-center gap-3 min-w-0">
        <Zap size={16} className={cn(
          'shrink-0',
          isEmpty ? 'text-error' : isLow ? 'text-amber-500' : 'text-primary',
        )} />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display text-sm font-semibold text-foreground">
              {creditsLeft} {t('cb_credits')}
            </span>
            <span className="font-mono text-xs text-[--text-muted]">/ {creditsTotal}</span>
            <span className="font-mono text-[10px] font-medium uppercase px-1.5 py-0.5 rounded bg-muted text-[--text-muted]">
              {plan}
            </span>
          </div>
          <p className="font-mono text-xs mt-0.5 text-[--text-muted] truncate">
            {contextLabel}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="hidden sm:block w-24 shrink-0">
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              isEmpty ? 'bg-error'
              : isLow ? 'bg-amber-400'
              : percentUsed > 50 ? 'bg-primary' : 'bg-emerald-400',
            )}
            style={{ width: `${Math.min(percentUsed, 100)}%` }}
          />
        </div>
      </div>

      {/* CTA */}
      {isStarter ? (
        <Link
          href="/pricing"
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-primary text-white hover:bg-brand-hover transition-colors"
        >
          {t('cb_upgrade')} <ArrowRight size={11} />
        </Link>
      ) : (
        <Link
          href="/settings/billing"
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-muted text-[--text-secondary] hover:bg-muted/80 transition-colors"
        >
          <ShoppingCart size={11} /> {t('cb_topup')}
        </Link>
      )}
    </div>
  )
}
