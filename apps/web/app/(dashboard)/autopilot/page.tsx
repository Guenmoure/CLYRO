'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Plus, Sparkles, Play, Pause, Trash2, Rocket, Calendar, Clock,
  AlertCircle, Loader2,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { useUser } from '@/hooks/use-user'
import { useLanguage } from '@/lib/i18n'
import { hasAutopilot, planLabel, type UserPlan } from '@/lib/plans'
import { UpgradeCard } from '@/components/plans/UpgradeCard'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
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
  const { t } = useLanguage()
  const plan = (profile?.plan ?? 'free') as UserPlan
  const unlocked = hasAutopilot(plan)

  const [series, setSeries] = useState<AutopilotSeries[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AutopilotSeries | null>(null)

  const reload = useCallback(async () => {
    try {
      setLoading(true)
      const { data } = await getAutopilotSeries()
      setSeries(data ?? [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('auto_load_failed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (unlocked) void reload()
    else setLoading(false)
  }, [unlocked, reload])

  async function handleCreate(payload: Parameters<typeof createAutopilotSeries>[0]) {
    const { data } = await createAutopilotSeries(payload)
    setSeries(prev => [data, ...prev])
    toast.success(t('auto_series_created'))
  }

  async function handleToggle(s: AutopilotSeries) {
    setBusyId(s.id)
    try {
      const { data } = await updateAutopilotSeries(s.id, { enabled: !s.enabled })
      setSeries(prev => prev.map(x => x.id === s.id ? data : x))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('auto_update_failed'))
    } finally {
      setBusyId(null)
    }
  }

  async function handleRun(s: AutopilotSeries) {
    setBusyId(s.id)
    try {
      const { data } = await runAutopilotSeries(s.id)
      setSeries(prev => prev.map(x => x.id === s.id ? data : x))
      toast.success(t('auto_run_queued'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('auto_run_failed'))
    } finally {
      setBusyId(null)
    }
  }

  async function handleDeleteConfirmed(s: AutopilotSeries) {
    setBusyId(s.id)
    try {
      await deleteAutopilotSeries(s.id)
      setSeries(prev => prev.filter(x => x.id !== s.id))
      toast.success(t('auto_series_deleted'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('auto_delete_failed'))
    } finally {
      setBusyId(null)
    }
  }

  // ── Locked state ───────────────────────────────────────────────────────────
  if (!unlocked) {
    return (
      <div className="px-4 sm:px-6 py-10 max-w-3xl mx-auto">
        <header className="mb-8">
          <h1 className="font-display text-2xl font-semibold text-foreground">{t('auto_title')}</h1>
          <p className="font-body text-sm text-[--text-muted] mt-1">
            {t('auto_subtitle_locked')}
          </p>
          <span className="inline-block mt-3 font-mono text-[11px] uppercase tracking-wide bg-muted text-[--text-muted] border border-border px-2 py-0.5 rounded-full">
            {t('auto_locked_on')} {planLabel(plan)}
          </span>
        </header>

        <UpgradeCard
          headline={t('auto_upgrade_headline')}
          description={<>{t('auto_upgrade_desc')}</>}
          plans={['Pro', 'Creator', 'Studio']}
        />
      </div>
    )
  }

  // Flagship = the enabled series with the most successful runs. Promote
  // its card to `highlight` so the eye lands on the creator's workhorse.
  const flagshipId = series
    .filter(s => s.enabled && s.run_count > 0)
    .sort((a, b) => b.run_count - a.run_count)[0]?.id

  return (
    <div className="px-4 sm:px-6 py-10 max-w-5xl mx-auto">
      <header className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">{t('auto_title')}</h1>
          <p className="font-body text-sm text-[--text-muted] mt-1">
            {series.length === 0
              ? t('auto_no_series')
              : t('auto_series_summary')
                  .replace('{count}', String(series.length))
                  .replace('{active}', String(series.filter(s => s.enabled).length))}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={14} aria-hidden="true" />
          {t('auto_new_series')}
        </Button>
      </header>

      {loading ? (
        <div className="flex items-center gap-2 text-[--text-muted] font-body text-sm">
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          {t('auto_loading')}
        </div>
      ) : series.length === 0 ? (
        <Card variant="default" padding="lg" className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <Rocket size={20} className="text-[--text-muted]" aria-hidden="true" />
          </div>
          <h2 className="font-display text-base font-semibold text-foreground">{t('auto_start_title')}</h2>
          <p className="font-body text-sm text-[--text-muted] mt-1 max-w-md mx-auto">
            {t('auto_start_desc')}
          </p>
          <Button onClick={() => setCreateOpen(true)} className="mt-5">
            <Sparkles size={14} aria-hidden="true" />
            {t('auto_create_first')}
          </Button>
        </Card>
      ) : (
        <ul className="space-y-3">
          {series.map(s => (
            <li key={s.id}>
              <Card variant={s.id === flagshipId ? 'highlight' : 'default'} padding="lg">
                <div className="flex items-start gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-display text-base font-semibold text-foreground truncate">
                        {s.name}
                      </h3>
                      <CadenceBadge cadence={s.cadence} />
                      {s.id === flagshipId && (
                        <span className="font-mono text-[11px] uppercase tracking-wide bg-blue-500/10 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full">
                          {t('auto_flagship')}
                        </span>
                      )}
                      {!s.enabled && (
                        <span className="font-mono text-[11px] uppercase tracking-wide bg-muted text-[--text-muted] border border-border px-2 py-0.5 rounded-full">
                          {t('auto_paused')}
                        </span>
                      )}
                    </div>
                    <p className="font-body text-sm text-[--text-muted] mt-1 line-clamp-2">
                      {s.topic}
                    </p>
                    <div className="flex items-center gap-4 mt-3 font-mono text-[11px] text-[--text-muted] flex-wrap">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar size={12} aria-hidden="true" />
                        {t('auto_next')} {s.cadence === 'manual' ? '—' : new Date(s.next_run_at).toLocaleString()}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock size={12} aria-hidden="true" />
                        {(s.run_count === 1 ? t('auto_runs_one') : t('auto_runs_many'))
                          .replace('{n}', String(s.run_count))}
                      </span>
                      <span>{s.format} · {s.duration}s · {s.language}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleRun(s)}
                      disabled={busyId === s.id}
                      className="inline-flex items-center gap-1.5 font-body text-xs font-medium px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
                      aria-label={t('auto_aria_run').replace('{name}', s.name)}
                    >
                      <Play size={12} aria-hidden="true" />
                      {t('auto_run_now')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggle(s)}
                      disabled={busyId === s.id}
                      className="inline-flex items-center gap-1.5 font-body text-xs font-medium px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
                      aria-label={(s.enabled ? t('auto_aria_pause') : t('auto_aria_resume')).replace('{name}', s.name)}
                    >
                      {s.enabled ? <Pause size={12} aria-hidden="true" /> : <Play size={12} aria-hidden="true" />}
                      {s.enabled ? t('auto_pause') : t('auto_resume')}
                    </button>
                    {/* Visual separator so Delete reads as destructive, not peer of primary actions */}
                    <div className="w-px h-6 bg-border/60 mx-0.5" aria-hidden="true" />
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(s)}
                      disabled={busyId === s.id}
                      className="inline-flex items-center justify-center w-11 h-11 rounded-lg border border-border bg-card text-[--text-muted] hover:text-red-400 hover:border-red-500/40 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60"
                      aria-label={t('auto_aria_delete').replace('{name}', s.name)}
                    >
                      <Trash2 size={14} aria-hidden="true" />
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
          {t('auto_credits_note')}
        </span>
      </div>

      <AutopilotCreateDialog
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
      />

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) await handleDeleteConfirmed(deleteTarget)
        }}
        title={t('auto_delete_title')}
        message={deleteTarget ? t('auto_delete_confirm').replace('{name}', deleteTarget.name) : ''}
      />
    </div>
  )
}

// ── Cadence badge ──────────────────────────────────────────────────────────────

function CadenceBadge({ cadence }: { cadence: AutopilotCadence }) {
  const { t } = useLanguage()
  const tone =
    cadence === 'daily'  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' :
    cadence === 'weekly' ? 'bg-blue-500/10 text-blue-300 border-blue-500/30' :
                           'bg-muted text-[--text-muted] border-border'
  const label =
    cadence === 'daily'  ? t('auto_cadence_daily_label') :
    cadence === 'weekly' ? t('auto_cadence_weekly_label') :
                           t('auto_cadence_manual_label')
  return (
    <span className={`font-mono text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${tone}`}>
      {label}
    </span>
  )
}
