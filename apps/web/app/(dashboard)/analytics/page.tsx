import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Activity, Film, Clock, CheckCircle2, XCircle, Sparkles, TrendingUp } from 'lucide-react'
import type { Database } from '@/lib/database.types'
import { Card } from '@/components/ui/card'
import { AnalyticsTimeline } from '@/components/analytics/AnalyticsTimeline'
import { StyleBreakdown } from '@/components/analytics/StyleBreakdown'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Analytics — CLYRO' }

// ── Types ──────────────────────────────────────────────────────────────────────

type VideoRow = {
  id: string
  module: string | null
  style: string | null
  status: string
  created_at: string
  metadata: Record<string, unknown> | null
}

interface Metrics {
  total: number
  done: number
  error: number
  processing: number
  last7: number
  last30: number
  prev30: number
  successRate: number
  avgDurationMinutes: number | null
  byStyle: Array<{ style: string; count: number }>
  byDay: Array<{ date: string; count: number }>
  topTitles: Array<{ id: string; title: string; status: string; created_at: string }>
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function computeMetrics(rows: Array<VideoRow & { title: string }>): Metrics {
  const now = Date.now()
  const DAY = 24 * 60 * 60 * 1000

  let done = 0
  let error = 0
  let processing = 0
  let last7 = 0
  let last30 = 0
  let prev30 = 0
  const styleCounts = new Map<string, number>()
  const dayCounts = new Map<string, number>()
  const durations: number[] = []

  for (const v of rows) {
    if (v.status === 'done') done++
    else if (v.status === 'error') error++
    else processing++

    const created = new Date(v.created_at).getTime()
    const ageDays = (now - created) / DAY
    if (ageDays <= 7) last7++
    if (ageDays <= 30) last30++
    else if (ageDays <= 60) prev30++

    const key = (v.style && v.style.trim()) || v.module || 'other'
    styleCounts.set(key, (styleCounts.get(key) ?? 0) + 1)

    const dayKey = new Date(v.created_at).toISOString().slice(0, 10)
    dayCounts.set(dayKey, (dayCounts.get(dayKey) ?? 0) + 1)

    const md = v.metadata as Record<string, unknown> | null
    if (md && typeof md.duration === 'number') durations.push(md.duration)
    else if (md && typeof md.total_duration === 'number') durations.push(md.total_duration)
  }

  const total = rows.length
  const finished = done + error
  const successRate = finished === 0 ? 0 : Math.round((done / finished) * 100)

  const avgDurationMinutes = durations.length > 0
    ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) / 60 * 10) / 10
    : null

  const byStyle = [...styleCounts.entries()]
    .map(([style, count]) => ({ style, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  // Build a continuous 30-day window so the timeline never has gaps.
  const byDay: Array<{ date: string; count: number }> = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now - i * DAY)
    const key = d.toISOString().slice(0, 10)
    byDay.push({ date: key, count: dayCounts.get(key) ?? 0 })
  }

  const topTitles = rows
    .filter(r => r.status === 'done')
    .slice(0, 6)
    .map(r => ({ id: r.id, title: r.title, status: r.status, created_at: r.created_at }))

  return {
    total,
    done,
    error,
    processing,
    last7,
    last30,
    prev30,
    successRate,
    avgDurationMinutes,
    byStyle,
    byDay,
    topTitles,
  }
}

function formatDelta(current: number, previous: number): { text: string; positive: boolean } {
  if (previous === 0) {
    if (current === 0) return { text: '—', positive: true }
    return { text: 'new', positive: true }
  }
  const pct = Math.round(((current - previous) / previous) * 100)
  const sign = pct >= 0 ? '+' : ''
  return { text: `${sign}${pct}%`, positive: pct >= 0 }
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function AnalyticsPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return (
      <div className="px-4 sm:px-6 py-16 max-w-2xl mx-auto">
        <div className="bg-muted border border-border rounded-2xl p-6">
          <p className="font-display text-sm text-foreground mb-1">Missing configuration</p>
          <p className="font-body text-xs text-[--text-muted]">Supabase environment variables are not set.</p>
        </div>
      </div>
    )
  }

  const supabase = createServerComponentClient<Database>({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?next=/analytics')

  // Pull up to 500 rows (60-day window is plenty for a personal analytics view).
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
  const { data: rawVideos } = await supabase
    .from('videos')
    .select('id, module, style, title, status, created_at, metadata')
    .eq('user_id', user.id)
    .gte('created_at', sixtyDaysAgo)
    .order('created_at', { ascending: false })
    .limit(500)

  const videos = (rawVideos ?? []) as Array<VideoRow & { title: string }>
  const m = computeMetrics(videos)
  const delta = formatDelta(m.last30, m.prev30)

  if (videos.length === 0) {
    return (
      <div className="px-4 sm:px-6 py-10 max-w-5xl mx-auto">
        <header className="mb-8">
          <h1 className="font-display text-2xl font-semibold text-foreground">Analytics</h1>
          <p className="font-body text-sm text-[--text-muted] mt-1">
            Track how your videos are performing — renders, styles, success rate.
          </p>
        </header>
        <Card variant="default" padding="lg" className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <Activity size={20} className="text-[--text-muted]" aria-hidden="true" />
          </div>
          <h2 className="font-display text-base font-semibold text-foreground">Nothing to chart yet</h2>
          <p className="font-body text-sm text-[--text-muted] mt-1 max-w-sm mx-auto">
            Render your first video and this page lights up — counts, top styles, a 30-day timeline.
          </p>
          <Link
            href="/faceless/new"
            className="inline-flex items-center gap-2 mt-5 bg-blue-500 text-white font-body font-medium px-4 py-2 rounded-xl text-sm hover:bg-blue-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Sparkles size={14} aria-hidden="true" />
            Create your first video
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-6 py-10 max-w-6xl mx-auto">
      <header className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">Analytics</h1>
          <p className="font-body text-sm text-[--text-muted] mt-1">
            Last 60 days · {m.total} videos
          </p>
        </div>
      </header>

      {/* KPI cards */}
      <section
        aria-label="Key metrics"
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8"
      >
        <KpiCard
          icon={<Film size={16} aria-hidden="true" />}
          label="Total videos"
          value={m.total.toString()}
          sublabel={`${m.last7} this week`}
        />
        <KpiCard
          icon={<TrendingUp size={16} aria-hidden="true" />}
          label="Last 30 days"
          value={m.last30.toString()}
          sublabel={delta.text === '—' ? 'vs prior 30d' : `${delta.text} vs prior 30d`}
          sublabelTone={delta.positive ? 'positive' : 'negative'}
          emphasis
        />
        <KpiCard
          icon={<CheckCircle2 size={16} aria-hidden="true" />}
          label="Success rate"
          value={`${m.successRate}%`}
          sublabel={`${m.done} completed · ${m.error} failed`}
        />
        <KpiCard
          icon={<Clock size={16} aria-hidden="true" />}
          label="Avg length"
          value={m.avgDurationMinutes !== null ? `${m.avgDurationMinutes} min` : '—'}
          sublabel={m.processing > 0 ? `${m.processing} in progress` : 'completed renders'}
        />
      </section>

      {/* Activity timeline */}
      <section aria-labelledby="activity-heading" className="mb-8">
        <Card variant="default" padding="lg">
          <div className="flex items-center justify-between mb-4">
            <h2 id="activity-heading" className="font-display text-sm font-semibold text-foreground">
              Activity — last 30 days
            </h2>
            <span className="font-mono text-[11px] text-[--text-muted]">
              {m.last30} videos
            </span>
          </div>
          <AnalyticsTimeline points={m.byDay} />
        </Card>
      </section>

      {/* Style breakdown + recent done */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card variant="default" padding="lg">
          <h2 className="font-display text-sm font-semibold text-foreground mb-4">
            Top styles
          </h2>
          {m.byStyle.length === 0 ? (
            <p className="font-body text-sm text-[--text-muted]">No style data yet.</p>
          ) : (
            <StyleBreakdown entries={m.byStyle} total={m.total} />
          )}
        </Card>

        <Card variant="default" padding="lg">
          <h2 className="font-display text-sm font-semibold text-foreground mb-4">
            Recent renders
          </h2>
          {m.topTitles.length === 0 ? (
            <p className="font-body text-sm text-[--text-muted]">No completed renders yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {m.topTitles.map(v => (
                <li key={v.id} className="py-2.5 first:pt-0 last:pb-0">
                  <Link
                    href={`/videos/${v.id}`}
                    className="flex items-center justify-between gap-3 hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 rounded"
                  >
                    <span className="font-body text-sm text-foreground truncate flex items-center gap-2 min-w-0">
                      {v.status === 'done' ? (
                        <CheckCircle2 size={14} className="text-emerald-400 shrink-0" aria-hidden="true" />
                      ) : (
                        <XCircle size={14} className="text-red-400 shrink-0" aria-hidden="true" />
                      )}
                      <span className="truncate">{v.title || 'Untitled'}</span>
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
  /** Promote this card visually — used for the KPI with the most momentum. */
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
