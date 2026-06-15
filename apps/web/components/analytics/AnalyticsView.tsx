'use client'

import Link from 'next/link'
import { Activity, Film, Clock, CheckCircle2, XCircle, Sparkles, TrendingUp } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { useLanguage } from '@/lib/i18n'
import { AnalyticsTimeline } from './AnalyticsTimeline'
import { StyleBreakdown } from './StyleBreakdown'
import type { Metrics } from '@/app/(dashboard)/analytics/page'

function formatDelta(current: number, previous: number): { text: string; positive: boolean } {
  if (previous === 0) {
    if (current === 0) return { text: '—', positive: true }
    return { text: 'new', positive: true }
  }
  const pct = Math.round(((current - previous) / previous) * 100)
  const sign = pct >= 0 ? '+' : ''
  return { text: `${sign}${pct}%`, positive: pct >= 0 }
}

export function AnalyticsView({ metrics: m, isEmpty }: { metrics: Metrics; isEmpty: boolean }) {
  const { t } = useLanguage()
  const delta = formatDelta(m.last30, m.prev30)

  if (isEmpty) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="font-display text-2xl font-semibold text-foreground">{t('an_title')}</h1>
          <p className="font-body text-sm text-[--text-muted] mt-1">
            {t('an_subtitle')}
          </p>
        </header>
        <EmptyState
          icon={Activity}
          title={t('an_emptyTitle')}
          description={t('an_emptyDesc')}
          accent="blue"
          size="lg"
          action={
            <Link
              href="/faceless/new"
              className="inline-flex items-center gap-2 bg-primary text-white font-body font-medium px-4 py-2 rounded-xl text-sm hover:bg-brand-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Sparkles size={14} aria-hidden="true" />
              {t('an_createFirst')}
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-6xl mx-auto">
      <header className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">{t('an_title')}</h1>
          <p className="font-body text-sm text-[--text-muted] mt-1">
            {t('an_period').replace('{n}', String(m.total))}
          </p>
        </div>
      </header>

      {/* KPI cards */}
      <section
        aria-label={t('an_keyMetrics')}
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8"
      >
        <KpiCard
          icon={<Film size={16} aria-hidden="true" />}
          label={t('an_totalVideos')}
          value={m.total.toString()}
          sublabel={t('an_thisWeek').replace('{n}', String(m.last7))}
        />
        <KpiCard
          icon={<TrendingUp size={16} aria-hidden="true" />}
          label={t('an_last30')}
          value={m.last30.toString()}
          sublabel={delta.text === '—' ? t('an_vsPrior') : `${delta.text} ${t('an_vsPrior')}`}
          sublabelTone={delta.positive ? 'positive' : 'negative'}
          emphasis
        />
        <KpiCard
          icon={<CheckCircle2 size={16} aria-hidden="true" />}
          label={t('an_successRate')}
          value={`${m.successRate}%`}
          sublabel={t('an_completedFailed').replace('{done}', String(m.done)).replace('{error}', String(m.error))}
        />
        <KpiCard
          icon={<Clock size={16} aria-hidden="true" />}
          label={t('an_avgLength')}
          value={m.avgDurationMinutes !== null ? `${m.avgDurationMinutes} min` : '—'}
          sublabel={m.processing > 0 ? t('an_inProgress').replace('{n}', String(m.processing)) : t('an_completedRenders')}
        />
      </section>

      {/* Activity timeline */}
      <section aria-labelledby="activity-heading" className="mb-8">
        <Card variant="default" padding="lg">
          <div className="flex items-center justify-between mb-4">
            <h2 id="activity-heading" className="font-display text-sm font-semibold text-foreground">
              {t('an_activity30')}
            </h2>
            <span className="font-mono text-[11px] text-[--text-muted]">
              {t('an_videosCount').replace('{n}', String(m.last30))}
            </span>
          </div>
          <AnalyticsTimeline points={m.byDay} />
        </Card>
      </section>

      {/* Style breakdown + recent done */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card variant="default" padding="lg">
          <h2 className="font-display text-sm font-semibold text-foreground mb-4">
            {t('an_topStyles')}
          </h2>
          {m.byStyle.length === 0 ? (
            <p className="font-body text-sm text-[--text-muted]">{t('an_noStyleData')}</p>
          ) : (
            <StyleBreakdown entries={m.byStyle} total={m.total} />
          )}
        </Card>

        <Card variant="default" padding="lg">
          <h2 className="font-display text-sm font-semibold text-foreground mb-4">
            {t('an_recentRenders')}
          </h2>
          {m.topTitles.length === 0 ? (
            <p className="font-body text-sm text-[--text-muted]">{t('an_noRenders')}</p>
          ) : (
            <ul className="divide-y divide-border">
              {m.topTitles.map(v => (
                <li key={v.id} className="py-2.5 first:pt-0 last:pb-0">
                  <Link
                    href={`/videos/${v.id}`}
                    className="flex items-center justify-between gap-3 hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded"
                  >
                    <span className="font-body text-sm text-foreground truncate flex items-center gap-2 min-w-0">
                      {v.status === 'done' ? (
                        <CheckCircle2 size={14} className="text-emerald-400 shrink-0" aria-hidden="true" />
                      ) : (
                        <XCircle size={14} className="text-red-400 shrink-0" aria-hidden="true" />
                      )}
                      <span className="truncate">{v.title || t('an_untitled')}</span>
                    </span>
                    <span className="font-mono text-[11px] text-[--text-muted] shrink-0">
                      {new Date(v.created_at).toLocaleDateString()}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  )
}

// ── KPI card ───────────────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  sublabel,
  sublabelTone = 'muted',
  emphasis = false,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sublabel?: string
  sublabelTone?: 'muted' | 'positive' | 'negative'
  emphasis?: boolean
}) {
  const subClass =
    sublabelTone === 'positive' ? 'text-emerald-400' :
    sublabelTone === 'negative' ? 'text-red-400' :
    'text-[--text-muted]'
  return (
    <Card variant={emphasis ? 'highlight' : 'default'} padding="md">
      <div className="flex items-center gap-2 text-[--text-muted] mb-2">
        {icon}
        <span className="font-body text-[11px] uppercase tracking-wide">{label}</span>
      </div>
      <p className={`font-display font-semibold text-foreground leading-none ${emphasis ? 'text-3xl' : 'text-2xl'}`}>
        {value}
      </p>
      {sublabel && (
        <p className={`font-mono text-[11px] mt-2 ${subClass}`}>{sublabel}</p>
      )}
    </Card>
  )
}
