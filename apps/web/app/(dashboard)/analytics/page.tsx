import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Database } from '@/lib/database.types'
import { AnalyticsView } from '@/components/analytics/AnalyticsView'

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

export interface Metrics {
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

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function AnalyticsPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-16 max-w-2xl mx-auto">
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
  const metrics = computeMetrics(videos)

  return <AnalyticsView metrics={metrics} isEmpty={videos.length === 0} />
}
