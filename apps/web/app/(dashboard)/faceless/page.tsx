'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Video, Loader2, AlertCircle, Check, Sparkles, Clapperboard } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createBrowserClient } from '@/lib/supabase'
import { useLanguage } from '@/lib/i18n'

type FacelessVideo = {
  id: string
  title: string | null
  status: string
  output_url: string | null
  thumbnail_url: string | null
  created_at: string
  duration_seconds: number | null
}

export default function FacelessIndexPage() {
  const { t } = useLanguage()
  const [videos, setVideos] = useState<FacelessVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const supabase = createBrowserClient()
        const { data: { user } } = await supabase.auth.getUser()
        const { data, error } = await supabase
          .from('videos')
          .select('id, title, status, output_url, thumbnail_url, created_at, duration_seconds')
          .eq('user_id', user?.id ?? '')
          .eq('module', 'faceless')
          .neq('status', 'draft')
          .order('created_at', { ascending: false })
          .limit(60)
        if (error) throw error
        setVideos((data ?? []) as FacelessVideo[])
      } catch {
        setLoadError(true)
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const STATUS_META: Record<string, { label: string; color: string; icon?: React.ReactNode }> = {
    pending:    { label: t('fl_statusPending'),    color: 'bg-muted text-[--text-muted]' },
    processing: { label: t('fl_statusProcessing'), color: 'bg-feature-faceless/15 text-feature-faceless',   icon: <Loader2 size={10} className="animate-spin" /> },
    storyboard: { label: t('fl_statusStoryboard'), color: 'bg-feature-faceless/15 text-feature-faceless',   icon: <Loader2 size={10} className="animate-spin" /> },
    visuals:    { label: t('fl_statusVisuals'),    color: 'bg-amber-500/15 text-amber-500', icon: <Loader2 size={10} className="animate-spin" /> },
    audio:      { label: t('fl_statusAudio'),      color: 'bg-violet-500/15 text-violet-500', icon: <Loader2 size={10} className="animate-spin" /> },
    assembly:   { label: t('fl_statusRendering'),  color: 'bg-violet-500/15 text-violet-500', icon: <Loader2 size={10} className="animate-spin" /> },
    done:       { label: t('fl_statusReady'),      color: 'bg-success/15 text-success', icon: <Check size={10} /> },
    error:      { label: t('fl_statusError'),      color: 'bg-error/15 text-error',         icon: <AlertCircle size={10} /> },
  }

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto bg-background px-4 sm:px-6 lg:px-8 py-8 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-[--text-muted]" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex-1 overflow-y-auto bg-background px-4 sm:px-6 lg:px-8 py-8 flex items-center justify-center">
        <div className="text-center space-y-3">
          <AlertCircle size={28} className="mx-auto text-error" />
          <p className="font-display text-sm font-semibold text-foreground">{t('loadError')}</p>
          <button type="button" onClick={() => window.location.reload()} className="font-body text-xs text-primary hover:underline">
            {t('retry')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Video size={14} className="text-feature-faceless" />
              <p className="font-mono text-[11px] uppercase tracking-widest text-[--text-secondary] font-semibold">{t('fl_moduleLabel')}</p>
            </div>
            <h1 className="font-display text-3xl font-bold text-foreground">{t('fl_heading')}</h1>
            <p className="font-body text-sm text-[--text-secondary] mt-1 max-w-xl">
              {t('fl_subtitle')}
            </p>
          </div>

          <Link href="/faceless/hub" className="group relative">
            <div className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-grad-cta text-white font-body text-sm font-semibold shadow-lg">
              <Plus size={16} className="group-hover:rotate-90 transition-transform duration-200" />
              {t('fl_newProject')}
            </div>
          </Link>
        </div>

        {/* Projects grid */}
        {videos.length === 0 ? (
          <Card variant="elevated" padding="xl" className="flex flex-col items-center text-center gap-5 py-20">
            <div className="relative">
              <div className="absolute inset-0 rounded-3xl bg-primary/10 blur-2xl" />
              <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-feature-faceless/15 to-feature-faceless/10 border border-border flex items-center justify-center">
                <Video size={32} className="text-feature-faceless" />
              </div>
            </div>
            <div className="space-y-1">
              <h2 className="font-display text-xl font-bold text-foreground">{t('fl_emptyTitle')}</h2>
              <p className="font-body text-sm text-[--text-secondary] max-w-md">
                {t('fl_emptyDesc')}
              </p>
            </div>
            <Link href="/faceless/hub" className="group relative mt-2">
              <div className="flex items-center gap-2.5 px-7 py-3.5 rounded-xl bg-grad-cta text-white font-body text-base font-semibold shadow-xl">
                <Clapperboard size={18} />
                {t('fl_createFirst')}
                <Sparkles size={14} className="opacity-80" />
              </div>
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <NewProjectCard newProjectLabel={t('fl_cardNewProject')} fromScriptLabel={t('fl_cardFromScript')} badgeLabel={t('fl_cardBadge')} />
            {videos.map((v) => (
              <FacelessVideoCard
                key={v.id}
                video={v}
                statusMeta={STATUS_META}
                untitledLabel={t('fl_untitled')}
                facelessLabel={t('fl_facelessLabel')}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── New project card ──────────────────────────���──────────────────────────

function NewProjectCard({ newProjectLabel, fromScriptLabel, badgeLabel }: { newProjectLabel: string; fromScriptLabel: string; badgeLabel: string }) {
  return (
    <Link href="/faceless/hub" className="group relative block rounded-2xl overflow-hidden aspect-[4/3]">
      <div className="absolute inset-0 bg-primary opacity-80 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="absolute inset-[1.5px] rounded-2xl bg-card group-hover:bg-card/90 transition-colors duration-300" />
      <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-primary blur-lg opacity-50 group-hover:opacity-80 transition-opacity duration-300" />
          <div className="relative w-14 h-14 rounded-full bg-grad-cta flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
            <Plus size={24} className="text-white group-hover:rotate-90 transition-transform duration-300" />
          </div>
        </div>
        <div className="text-center">
          <p className="font-display text-base font-bold text-foreground group-hover:text-white transition-colors duration-200">
            {newProjectLabel}
          </p>
          <p className="font-body text-xs text-[--text-muted] mt-0.5 group-hover:text-white/60 transition-colors duration-200">
            {fromScriptLabel}
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-feature-faceless/15 border border-feature-faceless/30 group-hover:bg-feature-faceless/25 transition-all duration-200">
          <Sparkles size={10} className="text-feature-faceless" />
          <span className="font-mono text-[10px] text-feature-faceless tracking-wider uppercase">{badgeLabel}</span>
        </div>
      </div>
    </Link>
  )
}

// ── Project card ─────────────────────────────────────────────────────────

function FacelessVideoCard({
  video,
  statusMeta,
  untitledLabel,
  facelessLabel,
}: {
  video: FacelessVideo
  statusMeta: Record<string, { label: string; color: string; icon?: React.ReactNode }>
  untitledLabel: string
  facelessLabel: string
}) {
  const meta = statusMeta[video.status] ?? statusMeta.pending
  const relativeDate = formatRelative(video.created_at)

  return (
    <Link
      href={video.output_url ?? `/faceless/hub?resume=${video.id}`}
      target={video.output_url ? '_blank' : undefined}
      rel={video.output_url ? 'noopener noreferrer' : undefined}
      className="card-interactive rounded-2xl border border-border bg-card overflow-hidden block"
    >
      <div className="aspect-video relative bg-gradient-to-br from-feature-faceless/20 to-feature-faceless/10 flex items-center justify-center">
        <div className="absolute inset-0 grid-bg opacity-[0.04]" />
        {video.output_url ? (
          <video src={video.output_url} className="absolute inset-0 w-full h-full object-cover" muted />
        ) : (
          <Video size={32} className="text-white/40 relative" />
        )}
        <span className={`absolute top-2 left-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider ${meta.color}`}>
          {meta.icon}
          {meta.label}
        </span>
        {video.duration_seconds != null && (
          <Badge className="absolute top-2 right-2 bg-black/40 text-white border-white/10" variant="neutral">
            {formatDuration(video.duration_seconds)}
          </Badge>
        )}
      </div>

      <div className="p-4 space-y-1">
        <p className="font-display font-semibold text-foreground truncate">
          {video.title ?? untitledLabel}
        </p>
        <div className="flex items-center gap-2 text-xs font-mono text-[--text-muted]">
          <span>{facelessLabel}</span>
          <span>·</span>
          <span>{relativeDate}</span>
        </div>
      </div>
    </Link>
  )
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return '<1m'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d`
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
