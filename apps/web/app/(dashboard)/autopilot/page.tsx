'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Plus, Sparkles, Play, Pause, Trash2, Rocket, Calendar, Clock,
  Lock, ArrowRight, AlertCircle, Loader2,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { useUser } from '@/hooks/use-user'
import { hasAutopilot, planLabel, type UserPlan } from '@/lib/plans'
import {
  getAutopilotSeries,
  createAutopilotSeries,
  updateAutopilotSeries,
  deleteAutopilotSeries,
  runAutopilotSeries,
  type AutopilotSeries,
  type AutopilotCadence,
} from '@/lib/api'
import { AutopilotCreateDialog } from '@/components/autopilot/AutopilotCreateDialog'

export default function AutopilotPage() {
  const { profile } = useUser()
  const plan = (profile?.plan ?? 'free') as UserPlan
  const unlocked = hasAutopilot(plan)

  const [series, setSeries] = useState<AutopilotSeries[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      setLoading(true)
      const { data } = await getAutopilotSeries()
      setSeries(data ?? [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load series')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (unlocked) void reload()
    else setLoading(false)
  }, [unlocked, reload])

  async function handleCreate(payload: Parameters<typeof createAutopilotSeries>[0]) {
    const { data } = await createAutopilotSeries(payload)
    setSeries(prev => [data, ...prev])
    toast.success('Series created')
  }

  async function handleToggle(s: AutopilotSeries) {
    setBusyId(s.id)
    try {
      const { data } = await updateAutopilotSeries(s.id, { enabled: !s.enabled })
      setSeries(prev => prev.map(x => x.id === s.id ? data : x))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setBusyId(null)
    }
  }

  async function handleRun(s: AutopilotSeries) {
    setBusyId(s.id)
    try {
      const { data } = await runAutopilotSeries(s.id)
      setSeries(prev => prev.map(x => x.id === s.id ? data : x))
      toast.success('On it — your next render is queued')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Run failed')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(s: AutopilotSeries) {
    if (!window.confirm(`Delete "${s.name}"? Scheduled runs will stop. Videos already rendered stay in your library.`)) return
    setBusyId(s.id)
    try {
      await deleteAutopilotSeries(s.id)
      setSeries(prev => prev.filter(x => x.id !== s.id))
      toast.success('Series deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setBusyId(null)
    }
  }

  // ── Locked state ───────────────────────────────────────────────────────────
  if (!unlocked) {
    return (
      <div className="px-4 sm:px-6 py-10 max-w-3xl mx-auto">
        <header className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="font-display text-2xl font-semibold text-foreground">Autopilot</h1>
            <span className="font-mono text-[10px] uppercase tracking-wide bg-muted text-[--text-muted] border border-border px-2 py-0.5 rounded-full">
              Locked on {planLabel(plan)}
            </span>
          </div>
          <p className="font-body text-sm text-[--text-muted]">
            Set a topic and cadence once — CLYRO writes, narrates, and renders a new video every day or week.
          </p>
        </header>

        <Card variant="gradient" padding="lg">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0" aria-hidden="true">
              <Lock size={18} className="text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-display text-base font-semibold text-foreground">
                Ship videos while you sleep
              </h2>
              <p className="font-body text-sm text-[--text-muted] mt-1">
                Set a topic and cadence once — CLYRO writes, narrates, and renders a new video every
                day or week. Included on <strong className="text-foreground">Pro</strong>,{' '}
                <strong className="text-foreground">Creator</strong>, and{' '}
                <strong className="text-foreground">Studio</strong>.
              </p>
              <Link
                href="/settings/billing"
                className="inline-flex items-center gap-2 mt-4 bg-blue-500 text-white font-body font-medium px-4 py-2 rounded-xl text-sm hover:bg-blue-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                See plans
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-6 py-10 max-w-5xl mx-auto">
      <header className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">Autopilot</h1>
          <p className="font-body text-sm text-[--text-muted] mt-1">
            {series.length === 0
              ? 'No series yet — create one to start auto-generating.'
              : `${series.length} ${series.length === 1 ? 'series' : 'series'} · ${series.filter(s => s.enabled).length} active`}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={14} aria-hidden="true" />
          New series
        </Button>
      </header>

      {loading ? (
        <div className="flex items-center gap-2 text-[--text-muted] font-body text-sm">
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          Loading…
        </div>
      ) : series.length === 0 ? (
        <Card variant="default" padding="lg" className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <Rocket size={20} className="text-[--text-muted]" aria-hidden="true" />
          </div>
          <h2 className="font-display text-base font-semibold text-foreground">Start your first series</h2>
          <p className="font-body text-sm text-[--text-muted] mt-1 max-w-md mx-auto">
            Pick a topic and a cadence. We handle the rest — script, visuals, voiceover, render — on schedule.
          </p>
          <Button onClick={() => setCreateOpen(true)} className="mt-5">
            <Sparkles size={14} aria-hidden="true" />
            Create your first series
          </Button>
        </Card>
      ) : (
        <ul className="space-y-3">
          {series.map(s => (
            <li key={s.id}>
              <Card variant="default" padding="lg">
                <div className="flex items-start gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-display text-base font-semibold text-foreground truncate">
                        {s.name}
                      </h3>
                      <CadenceBadge cadence={s.cadence} />
                      {!s.enabled && (
                        <span className="font-mono text-[10px] uppercase tracking-wide bg-muted text-[--text-muted] border border-border px-2 py-0.5 rounded-full">
                          Paused
                        </span>
                      )}
                    </div>
                    <p className="font-body text-sm text-[--text-muted] mt-1 line-clamp-2">
                      {s.topic}
                    </p>
                    <div className="flex items-center gap-4 mt-3 font-mono text-[11px] text-[--text-muted] flex-wrap">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar size={11} aria-hidden="true" />
                        Next: {s.cadence === 'manual' ? '—' : new Date(s.next_run_at).toLocaleString()}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock size={11} aria-hidden="true" />
                        {s.run_count} run{s.run_count === 1 ? '' : 's'}
                      </span>
                      <span>{s.format} · {s.duration}s · {s.language}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleRun(s)}
                      disabled={busyId === s.id}
                      className="inline-flex items-center gap-1.5 font-body text-xs font-medium px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
                      aria-label={`Run "${s.name}" now`}
                    >
                      <Play size={12} aria-hidden="true" />
                      Run now
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggle(s)}
                      disabled={busyId === s.id}
                      className="inline-flex items-center gap-1.5 font-body text-xs font-medium px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
                      aria-label={s.enabled ? `Pause "${s.name}"` : `Resume "${s.name}"`}
                    >
                      {s.enabled ? <Pause size={12} aria-hidden="true" /> : <Play size={12} aria-hidden="true" />}
                      {s.enabled ? 'Pause' : 'Resume'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(s)}
                      disabled={busyId === s.id}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-card text-[--text-muted] hover:text-red-400 hover:border-red-500/40 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60"
                      aria-label={`Delete "${s.name}"`}
                    >
                      <Trash2 size={12} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {/* Info footer */}
      <div className="mt-8 flex items-start gap-2 text-[--text-muted] font-body text-xs">
        <AlertCircle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>
          Each run uses credits like a regular render. Pause anytime — we won't charge for a paused series.
        </span>
      </div>

      <AutopilotCreateDialog
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
      />
    </div>
  )
}

// ── Cadence badge ──────────────────────────────────────────────────────────────

function CadenceBadge({ cadence }: { cadence: AutopilotCadence }) {
  const tone =
    cadence === 'daily'  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' :
    cadence === 'weekly' ? 'bg-blue-500/10 text-blue-300 border-blue-500/30' :
                           'bg-muted text-[--text-muted] border-border'
  return (
    <span className={`font-mono text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${tone}`}>
      {cadence}
    </span>
  )
}
