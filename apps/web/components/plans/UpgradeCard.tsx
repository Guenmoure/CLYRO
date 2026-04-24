import { ArrowRight, Lock } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'

/**
 * Reusable "locked — upgrade to unlock" card used across plan-gated pages.
 *
 * Extracted from the identical locked-state blocks in:
 *   - apps/web/app/(dashboard)/autopilot/page.tsx
 *   - apps/web/app/(dashboard)/settings/white-label/page.tsx
 *
 * Keep this the single source of truth — next plan-gated feature should
 * import from here, not re-implement the gradient + lock + CTA.
 */
export interface UpgradeCardProps {
  /** Headline — lead with the outcome, not the feature name. */
  headline: string
  /** 1-2 sentence body explaining what unlocks and for whom. */
  description: React.ReactNode
  /** Which plans unlock this, in reading order. */
  plans?: string[]
  /** CTA destination. Defaults to billing. */
  ctaHref?: string
  /** CTA label. Defaults to "See plans". */
  ctaLabel?: string
  /** Optional className override on the outer Card. */
  className?: string
}

export function UpgradeCard({
  headline,
  description,
  plans,
  ctaHref = '/settings/billing',
  ctaLabel = 'See plans',
  className,
}: UpgradeCardProps) {
  return (
    <Card variant="gradient" padding="lg" className={className}>
      <div className="flex items-start gap-4">
        <div
          className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0"
          aria-hidden="true"
        >
          <Lock size={18} className="text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-base font-semibold text-foreground">
            {headline}
          </h2>
          <div className="font-body text-sm text-[--text-muted] mt-1">
            {description}
            {plans && plans.length > 0 && (
              <>
                {' '}Included on{' '}
                {plans.map((p, i) => (
                  <span key={p}>
                    <strong className="text-foreground">{p}</strong>
                    {i < plans.length - 2 ? ', ' : i === plans.length - 2 ? ', and ' : ''}
                  </span>
                ))}
                .
              </>
            )}
          </div>
          <Link
            href={ctaHref}
            className="inline-flex items-center gap-2 mt-4 bg-blue-500 text-white font-body font-medium px-4 py-2 rounded-xl text-sm hover:bg-blue-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {ctaLabel}
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </Card>
  )
}
