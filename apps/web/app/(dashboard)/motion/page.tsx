'use client'

/**
 * Motion entry — same editorial pattern as /faceless (Vague 3, 23/06/26).
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Sparkles, Loader2, AlertCircle, Check, Clapperboard } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase'
import { useLanguage } from '@/lib/i18n'

type MotionVideo = {
  id: string
  title: string | null
  status: string
  output_url: string | null
  thumbnail_url: string | null
  created_at: string
  duration_seconds: number | null
}

export default function MotionIndexPage() {
  const { t } = useLanguage()
  const [videos, setVideos] = useState<MotionVideo[]>([])
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
          .in('module', ['motion', 'motion_design'])
          .neq('status', 'draft')
          .order('created_at', { ascending: false })
          .limit(60)
        if (error) throw error
        setVideos((data ?? []) as MotionVideo[])
      } catch {
        setLoadError(true)
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const STATUS_META: Record<string, { label: string; tone: string; icon?: React.ReactNode }> = {
    pending:    { label: t('ml_statusPending'),    tone: 'muted'   },
    processing: { label: t('ml_statusProcessing'), tone: 'primary', icon: <Loader2 size={9} className="animate-spin" /> },
    assembly:   { label: t('ml_statusRendering'),  tone: 'primary', icon: <Loader2 size={9} className="animate-spin" /> },
    done:       { label: t('ml_statusReady'),      tone: 'success', icon: <Check size={9} /> },
    error:      { label: t('ml_statusError'),      tone: 'error',   icon: <AlertCircle size={9} /> },
  }

  function Header() {
    return (
      <header className="mb-10">
        <div className="divider-with-num">
          <span className="eyebrow">{t('nav_sec_create')}</span>
          <hr />
          <span className="folio">№ 03 / 12</span>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="h-display">{t('ml_heading')}</h1>
          <Link
            href="/motion/hub"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-foreground text-background border border-foreground font-mono text-[10px] uppercase tracking-[0.14em] hover:bg-primary hover:border-primary transition-colors"
          >
            <Plus size={12} />
            {t('ml_newProject')}
          </Link>
        </div>
        <p className="lead mt-5">{t('ml_subtitle')}</p>
        <hr className="rule-thin mt-8" />
      </header>
    )
  }

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto bg-background">
        <div className="px-4 sm:px-6 lg:px-12 py-12 max-w-6xl mx-auto">
          <Header />
          <div className="flex items-center justify-center py-24">
            <Loader2 size={20} className="animate-spin text-[--text-muted]" />
          </div>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex-1 overflow-y-auto bg-background">
        <div className="px-4 sm:px-6 lg:px-12 py-12 max-w-6xl mx-auto">
          <Header />
          <div className="py-24 text-center">
            <AlertCircle size={24} className="mx-auto text-[--text-muted] mb-3" />
            <p className="h-card">{t('loadError')}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-primary hover:underline"
            >
              {t('retry')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="px-4 sm:px-6 lg:px-12 py-12 max-w-6xl mx-auto">
        <Header />

        {videos.length === 0 ? (
          <div className="border border-border rounded-md bg-card p-12 text-center">
            <div className="folio mb-4">MO.00</div>
            <h2 className="h-card mb-3">{t('ml_emptyTitle')}</h2>
            <p className="lead mx-auto mb-8">{t('ml_emptyDesc')}</p>
            <Link
              href="/motion/hub"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-foreground text-background border border-foreground font-mono text-[11px] uppercase tracking-[0.14em] hover:bg-primary hover:border-primary transition-colors"
            >
              <Clapperboard size={13} />
              {t('ml_createFirst')}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <NewProjectTile
              label={t('ml_cardNewProject')}
              hint={t('ml_cardFromPrompt')}
              badge={t('ml_cardBadge')}
            />
            {videos.map((v) => (
              <MotionVideoTile
                key={v.id}
                video={v}
                statusMeta={STATUS_META}
                untitledLabel={t('ml_untitled')}
                motionLabel={t('ml_motionLabel')}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function NewProjectTile({ label, hint, badge }: { label: string; hint: string; badge: string }) {
  return (
    <Link
      href="/motion/hub"
      className="tile block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 group"
      aria-label={label}
    >
      <div className="ph relative flex items-center justify-center" style={{ aspectRatio: '4 / 3' }}>
        <div className="ph-folio">MO.NEW</div>
        <div className="flex flex-col items-center gap-3">
          <span className="w-12 h-12 rounded-full bg-foreground text-background flex items-center justify-center group-hover:bg-primary transition-colors">
            <Plus size={20} />
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-foreground">{badge}</span>
        </div>
      </div>
      <div className="tile-body">
        <h3 className="h-card">{label}</h3>
        <p className="font-body text-sm text-[--text-secondary] mt-1">{hint}</p>
      </div>
    </Link>
  )
}

function MotionVideoTile({
  video,
  statusMeta,
  untitledLabel,
  motionLabel,
}: {
  video: MotionVideo
  statusMeta: Record<string, { label: string; tone: string; icon?: React.ReactNode }>
  untitledLabel: string
  motionLabel: string
}) {
  const meta = statusMeta[video.status] ?? statusMeta.pending
  const relativeDate = formatRelative(video.created_at)

  const toneClass =
    meta.tone === 'success' ? 'text-success'  :
    meta.tone === 'error'   ? 'text-error'    :
    meta.tone === 'warning' ? 'text-warning'  :
    meta.tone === 'primary' ? 'text-primary'  :
                              'text-[--text-muted]'

  return (
    <Link
      href={video.output_url ?? `/motion/hub?draft=${video.id}`}
      target={video.output_url ? '_blank' : undefined}
      rel={video.output_url ? 'noopener noreferrer' : undefined}
      className="tile block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <div className="ph relative" style={{ aspectRatio: '16 / 9' }}>
        {video.output_url ? (
          <video src={video.output_url} className="absolute inset-0 w-full h-full object-cover" muted />
        ) : (
          <Sparkles size={28} className="text-[--text-muted]" />
        )}
        {video.duration_seconds != null && (
          <span className="ph-tag">{formatDuration(video.duration_seconds)}</span>
        )}
        <div className="ph-folio">MO.{video.id.slice(0, 6).toUpperCase()}</div>
      </div>
      <div className="tile-body">
        <div className="folio mb-2 flex items-center gap-1.5">
          <span className={toneClass + ' inline-flex items-center gap-1'}>
            {meta.icon}
            {meta.label}
          </span>
        </div>
        <h3 className="h-card truncate">
          {video.title ?? untitledLabel}
        </h3>
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[--text-muted] mt-2">
          {motionLabel} · {relativeDate}
        </p>
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
