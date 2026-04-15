'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Loader2, Video, Sparkles, Palette, Zap, Clock,
  Table as TableIcon, LineChart as LineChartIcon, Download,
} from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'

interface VideoItem {
  id: string
  title: string | null
  module: string | null
  status: string
  created_at: string
  duration_seconds?: number | null
}

type Tab = 'usage' | 'history'
type View = 'table' | 'graph'

const MODULE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  faceless: { label: 'Faceless', icon: Video,     color: 'text-blue-500'   },
  motion:   { label: 'Motion',   icon: Sparkles,  color: 'text-purple-500' },
  brand:    { label: 'Brand',    icon: Palette,   color: 'text-cyan-500'   },
}

export function UsageHistorySection() {
  const supabase = createBrowserClient()
  const [loading, setLoading] = useState(true)
  const [tab,  setTab]  = useState<Tab>('usage')
  const [view, setView] = useState<View>('table')
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [plan, setPlan] = useState<string>('free')
  const [credits, setCredits] = useState(0)

  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) return

        const [{ data: profile }, { data: videosData }] = await Promise.all([
          supabase.from('profiles').select('plan, credits').eq('id', session.user.id).maybeSingle(),
          supabase
            .from('videos')
            .select('id, title, module, status, created_at, duration_seconds')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false })
            .limit(200),
        ])
        if (profile) {
          setPlan(profile.plan ?? 'free')
          setCredits(profile.credits ?? 0)
        }
        setVideos((videosData ?? []) as VideoItem[])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supabase])

  // ── Stats ────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const done = videos.filter((v) => v.status === 'done')
    const byModule = { faceless: 0, motion: 0, brand: 0 }
    let totalSeconds = 0
    for (const v of done) {
      const mod = (v.module ?? '') as keyof typeof byModule
      if (mod in byModule) byModule[mod]++
      totalSeconds += v.duration_seconds ?? 0
    }
    return { total: done.length, byModule, totalSeconds }
  }, [videos])

  // Monthly creation chart (last 6 months)
  const monthlyData = useMemo(() => {
    const now = new Date()
    const months: { label: string; count: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const label = d.toLocaleDateString('fr-FR', { month: 'short' })
      const count = videos.filter((v) => {
        const created = new Date(v.created_at)
        return created.getFullYear() === d.getFullYear() && created.getMonth() === d.getMonth()
      }).length
      months.push({ label, count })
    }
    return months
  }, [videos])

  const maxMonthlyCount = Math.max(1, ...monthlyData.map((m) => m.count))

  function downloadCSV() {
    const rows = [
      ['Title', 'Module', 'Status', 'Duration (s)', 'Created at'],
      ...videos.map((v) => [
        v.title ?? '',
        v.module ?? '',
        v.status,
        String(v.duration_seconds ?? ''),
        v.created_at,
      ]),
    ]
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `clyro-usage-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return <div className="py-20 flex items-center justify-center"><Loader2 className="animate-spin text-[--text-muted]" /></div>
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground">Usage & Historique</h2>
        <p className="font-body text-sm text-[--text-secondary] mt-1">
          Statistiques d&apos;utilisation et détail de tes générations.
        </p>
      </div>

      {/* Tabs — Usage | Historique */}
      <div className="flex items-center gap-6 border-b border-border">
        {(['usage', 'history'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'relative pb-3 text-sm font-body transition-colors',
              tab === t
                ? 'text-foreground font-semibold'
                : 'text-[--text-secondary] hover:text-foreground',
            )}
          >
            {t === 'usage' ? 'Usage' : 'Historique'}
            {tab === t && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-blue-500 rounded-full" />}
          </button>
        ))}
      </div>

      {tab === 'usage' && (
        <div className="space-y-5">
          {/* Quota cards */}
          <UsageQuotaCard
            icon={Zap}
            label="Crédits restants"
            description={`Plan ${plan.charAt(0).toUpperCase() + plan.slice(1)}`}
            used={plan === 'studio' ? 0 : Math.max(0, 10 - credits)}
            total={plan === 'studio' ? null : 10}
            color="warning"
          />
          <UsageQuotaCard
            icon={Video}
            label="Vidéos Faceless"
            description="Générations terminées avec succès"
            used={stats.byModule.faceless}
            total={null}
            color="blue"
          />
          <UsageQuotaCard
            icon={Sparkles}
            label="Vidéos Motion"
            description="Générations terminées avec succès"
            used={stats.byModule.motion}
            total={null}
            color="purple"
          />
          <UsageQuotaCard
            icon={Clock}
            label="Durée totale générée"
            description={`${formatDuration(stats.totalSeconds)} de contenu vidéo`}
            used={Math.round(stats.totalSeconds / 60)}
            total={null}
            color="emerald"
            unit="min"
          />
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-4">
          {/* View toggle + download */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card p-1">
              {(['table', 'graph'] as const).map((v) => {
                const Icon = v === 'table' ? TableIcon : LineChartIcon
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setView(v)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-body transition-colors',
                      view === v
                        ? 'bg-foreground text-background font-medium'
                        : 'text-[--text-secondary] hover:text-foreground',
                    )}
                  >
                    <Icon size={12} />
                    {v === 'table' ? 'Tableau' : 'Graphique'}
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              onClick={downloadCSV}
              disabled={videos.length === 0}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-body text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              <Download size={12} /> Exporter CSV
            </button>
          </div>

          {view === 'table' ? <HistoryTable videos={videos} /> : <HistoryGraph data={monthlyData} max={maxMonthlyCount} total={videos.length} />}
        </div>
      )}
    </div>
  )
}

// ── Usage quota card ───────────────────────────────────────────────────────

function UsageQuotaCard({
  icon: Icon, label, description, used, total, color, unit,
}: {
  icon: React.ElementType
  label: string
  description: string
  used: number
  total: number | null
  color: 'warning' | 'blue' | 'purple' | 'emerald'
  unit?: string
}) {
  const colorMap = {
    warning: { bg: 'bg-amber-500/10',   icon: 'text-amber-500',   bar: 'bg-amber-500'   },
    blue:    { bg: 'bg-blue-500/10',    icon: 'text-blue-500',    bar: 'bg-blue-500'    },
    purple:  { bg: 'bg-purple-500/10',  icon: 'text-purple-500',  bar: 'bg-purple-500'  },
    emerald: { bg: 'bg-emerald-500/10', icon: 'text-emerald-500', bar: 'bg-emerald-500' },
  }[color]
  const percent = total ? Math.min(100, (used / total) * 100) : 0

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', colorMap.bg)}>
            <Icon size={16} className={colorMap.icon} />
          </div>
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold text-foreground">{label}</p>
            <p className="font-body text-xs text-[--text-secondary] mt-0.5">{description}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="font-mono text-lg font-bold text-foreground">
            {used}{unit ? ` ${unit}` : ''}
            {total !== null && <span className="text-[--text-muted] font-normal"> / {total}</span>}
          </p>
        </div>
      </div>
      {total !== null && (
        <div className="mt-3 h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div className={cn('h-full rounded-full transition-all', colorMap.bar)} style={{ width: `${percent}%` }} />
        </div>
      )}
    </div>
  )
}

// ── History table ──────────────────────────────────────────────────────

function HistoryTable({ videos }: { videos: VideoItem[] }) {
  if (videos.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card px-4 py-12 text-center">
        <p className="font-body text-sm text-[--text-secondary]">Aucune génération pour l&apos;instant.</p>
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="grid grid-cols-[1fr_auto_auto_auto] md:grid-cols-[1fr_100px_120px_100px] gap-3 px-4 py-3 border-b border-border bg-muted/40">
        <span className="font-mono text-[10px] uppercase tracking-widest text-[--text-secondary] font-semibold">Titre</span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-[--text-secondary] font-semibold">Module</span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-[--text-secondary] font-semibold">Date</span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-[--text-secondary] font-semibold text-right">Durée</span>
      </div>
      <div className="divide-y divide-border max-h-[380px] overflow-y-auto">
        {videos.slice(0, 50).map((v) => {
          const meta = MODULE_META[v.module ?? '']
          const ModuleIcon = meta?.icon ?? Video
          return (
            <div key={v.id} className="grid grid-cols-[1fr_auto_auto_auto] md:grid-cols-[1fr_100px_120px_100px] gap-3 px-4 py-3 items-center hover:bg-muted/30 transition-colors">
              <span className="font-body text-sm text-foreground truncate">
                {v.title ?? 'Sans titre'}
              </span>
              <span className={cn('inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-wider', meta?.color ?? 'text-[--text-muted]')}>
                <ModuleIcon size={11} /> {meta?.label ?? v.module ?? '—'}
              </span>
              <span className="font-mono text-[11px] text-[--text-secondary]">
                {new Date(v.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
              <span className="font-mono text-[11px] text-[--text-secondary] text-right">
                {v.duration_seconds ? formatDuration(v.duration_seconds) : '—'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── History graph ──────────────────────────────────────────────────────

function HistoryGraph({
  data, max, total,
}: {
  data: { label: string; count: number }[]
  max: number
  total: number
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-[--text-secondary] font-semibold">Vidéos créées</p>
          <p className="font-display text-2xl font-bold text-foreground mt-1">{total}</p>
          <p className="font-body text-xs text-[--text-secondary]">sur les 6 derniers mois</p>
        </div>
      </div>
      {/* Bar chart */}
      <div className="flex items-end gap-2 h-40">
        {data.map((m) => {
          const height = (m.count / max) * 100
          return (
            <div key={m.label} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="w-full flex-1 flex items-end">
                <div
                  className="w-full rounded-t-lg bg-gradient-to-t from-blue-500 to-purple-500 transition-all duration-500"
                  style={{ height: `${Math.max(height, 3)}%` }}
                  title={`${m.count} vidéos`}
                />
              </div>
              <span className="font-mono text-[10px] text-[--text-muted] uppercase">{m.label}</span>
              <span className="font-mono text-[11px] text-foreground font-semibold">{m.count}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Utils ─────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (!seconds) return '0s'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}h ${m}min`
  if (m > 0) return `${m}min ${s}s`
  return `${s}s`
}
