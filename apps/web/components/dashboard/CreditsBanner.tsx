import Link from 'next/link'
import { Zap, ArrowRight, ShoppingCart } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Derive a plan's "total credits" so we can show a progress bar.
 * The DB only stores credits remaining; we reconstruct the total from plan.
 */
export function getPlanTotal(plan: string): number {
  switch (plan.toLowerCase()) {
    case 'pro':    return 2000
    case 'studio': return 10000
    default:       return 250   // free / starter
  }
}

// ── Component ──────────────────────────────────────────────────────────────────

interface CreditsBannerProps {
  plan:         string
  creditsLeft:  number
  creditsTotal?: number  // optional — inferred from plan if omitted
}

export function CreditsBanner({ plan, creditsLeft, creditsTotal: propTotal }: CreditsBannerProps) {
  const creditsTotal = propTotal ?? getPlanTotal(plan)
  const creditsUsed  = Math.max(0, creditsTotal - creditsLeft)

  // Contextual label — makes the abstract credit number feel tangible
  const canDoFast       = Math.floor(creditsLeft / 120)
  const canDoStoryboard = Math.floor(creditsLeft / 25)

  const isEmpty = creditsLeft <= 0
  const isLow   = !isEmpty && creditsLeft < 50
  const percentUsed = Math.min(100, Math.round((creditsUsed / creditsTotal) * 100))

  const isStarter = ['free', 'starter'].includes(plan.toLowerCase())

  const contextLabel = isEmpty
    ? 'No credits left — get a top-up to continue'
    : isLow
    ? `~${canDoStoryboard} storyboard video${canDoStoryboard !== 1 ? 's' : ''} remaining`
    : `~${canDoFast} Fast 5-min video${canDoFast !== 1 ? 's' : ''} or ~${canDoStoryboard} Storyboard`

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
          isEmpty ? 'text-error' : isLow ? 'text-amber-500' : 'text-blue-400',
        )} />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display text-sm font-semibold text-foreground">
              {creditsLeft} credits
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
              : percentUsed > 50 ? 'bg-blue-400' : 'bg-emerald-400',
            )}
            style={{ width: `${Math.min(percentUsed, 100)}%` }}
          />
        </div>
      </div>

      {/* CTA */}
      {isStarter ? (
        <Link
          href="/pricing"
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500 text-white hover:bg-blue-400 transition-colors"
        >
          Upgrade <ArrowRight size={11} />
        </Link>
      ) : (
        <Link
          href="/settings"
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-[--text-secondary] hover:bg-muted/80 transition-colors"
        >
          <ShoppingCart size={11} /> Top-up
        </Link>
      )}
    </div>
  )
}
