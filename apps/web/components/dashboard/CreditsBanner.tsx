import Link from 'next/link'
import { Zap, ArrowRight, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Returns a plain-English interpretation of how many credits a user has,
 * so the number feels meaningful rather than abstract.
 *
 * Rule of thumb — 1 credit ≈ 1 faceless video minute, so:
 *   ≥ 60 credits  → "~X videos"
 *   10–59 credits → "~X short videos"
 *   1–9 credits   → "1–2 more videos"
 *   0 credits     → "no videos"
 */
function creditsContext(credits: number): string {
  if (credits === 0)   return 'No videos remaining this month'
  if (credits <= 9)    return `~${Math.max(1, Math.floor(credits / 2))} more video${credits <= 4 ? '' : 's'} remaining`
  if (credits <= 30)   return `~${Math.floor(credits / 5)} short videos remaining`
  return `~${Math.floor(credits / 10)} full videos remaining`
}

/** Color tier based on credit quantity */
function creditsTier(credits: number): 'empty' | 'low' | 'ok' | 'full' {
  if (credits === 0) return 'empty'
  if (credits <= 5)  return 'low'
  if (credits <= 20) return 'ok'
  return 'full'
}

// ── Component ──────────────────────────────────────────────────────────────────

interface CreditsBannerProps {
  credits:  number
  plan:     string
  /** Show upgrade CTA only on free / starter plans */
  showUpgrade?: boolean
}

export function CreditsBanner({ credits, plan, showUpgrade = true }: CreditsBannerProps) {
  const tier     = creditsTier(credits)
  const context  = creditsContext(credits)
  const isStarter = plan !== 'pro' && plan !== 'studio'

  const barFill = Math.min(100, Math.round((credits / 60) * 100))

  const tierStyles = {
    empty: {
      bar:    'bg-error',
      text:   'text-error',
      badge:  'bg-error/10 text-error border-error/20',
    },
    low: {
      bar:    'bg-amber-400',
      text:   'text-amber-400',
      badge:  'bg-amber-500/10 text-amber-400 border-amber-500/20',
    },
    ok: {
      bar:    'bg-blue-400',
      text:   'text-blue-400',
      badge:  'bg-blue-500/10 text-blue-400 border-blue-500/20',
    },
    full: {
      bar:    'bg-emerald-400',
      text:   'text-emerald-400',
      badge:  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    },
  }[tier]

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border/60 bg-card px-5 py-3.5">
      {/* Icon */}
      <div className="shrink-0 bg-muted rounded-xl p-2.5">
        {tier === 'full' || tier === 'ok'
          ? <TrendingUp size={16} className={tierStyles.text} />
          : <Zap        size={16} className={tierStyles.text} />
        }
      </div>

      {/* Credits + context */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className={cn('font-display text-sm font-bold', tierStyles.text)}>
            {credits} credit{credits !== 1 ? 's' : ''}
          </span>
          <span className="font-body text-xs text-[--text-muted]">
            · {context}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-1.5 h-1 bg-muted rounded-full overflow-hidden w-full max-w-48">
          <div
            className={cn('h-full rounded-full transition-all duration-500', tierStyles.bar)}
            style={{ width: `${barFill}%` }}
          />
        </div>
      </div>

      {/* Plan badge */}
      <span className={cn(
        'shrink-0 inline-flex items-center px-2.5 py-1 rounded-lg border',
        'font-mono text-xs font-medium capitalize',
        tierStyles.badge,
      )}>
        {plan}
      </span>

      {/* Upgrade CTA — only for non-pro users */}
      {isStarter && showUpgrade && (
        <Link
          href="/pricing"
          className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-blue-500 hover:text-blue-400 transition-colors font-mono"
        >
          Upgrade
          <ArrowRight size={11} />
        </Link>
      )}
    </div>
  )
}
