'use client'

/**
 * ProjectsSection — "Recent projects" grid for the dashboard home (HeyGen pattern).
 *
 * Filter tabs: All | Drafts
 * Grid: up to 10 projects + a "+ New" card at the end.
 * Clicking a project navigates to the video page or resumes a draft.
 * "View all" links to /projects.
 *
 * When `userId` is provided, project cards update in realtime via
 * Supabase Realtime (RealtimeProjects) — status transitions patch the
 * local list without a refetch.
 *
 * The parent (page.tsx) passes SSR-fetched videos; this component keeps
 * them in local state so realtime patches can apply.
 */

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n'
import { ProjectCard } from './ProjectCard'
import { RealtimeProjects } from './RealtimeProjects'
import type { VideoProject } from './ProjectCard'

// ── Props ──────────────────────────────────────────────────────────────────────

interface ProjectsSectionProps {
  videos:     VideoProject[]
  draftCount: number
  /** Enables Supabase Realtime updates on the cards when provided. */
  userId?:    string
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ProjectsSection({ videos: initialVideos, draftCount, userId }: ProjectsSectionProps) {
  const router = useRouter()
  const { t } = useLanguage()
  const [filter, setFilter] = useState<'all' | 'draft'>('all')
  const [videos, setVideos] = useState<VideoProject[]>(initialVideos)

  const handleRealtimeUpdate = useCallback((id: string, patch: Partial<VideoProject>) => {
    setVideos(prev => prev.map(v => (v.id === id ? { ...v, ...patch } : v)))
  }, [])

  const handleDeleted = useCallback((id: string) => {
    setVideos(prev => prev.filter(v => v.id !== id))
  }, [])

  const filtered = filter === 'draft'
    ? videos.filter(v => v.status === 'draft')
    : videos

  const displayed = filtered.slice(0, 10)

  return (
    <section className="space-y-4" aria-label={t('dash_recentProjects')}>
      {/* Realtime status updates on the cards */}
      {userId && <RealtimeProjects userId={userId} onUpdate={handleRealtimeUpdate} />}

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-base font-semibold text-foreground">
            {t('dash_recentProjects')}
          </h2>

          {/* Filter tabs */}
          <div role="tablist" aria-label={t('dash_recentProjects')} className="flex items-center gap-0.5 p-0.5 rounded-xl bg-muted">
            {[
              { id: 'all',   label: t('dash_all'),    count: videos.length },
              { id: 'draft', label: t('dash_drafts'), count: draftCount },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={filter === tab.id}
                onClick={() => setFilter(tab.id as 'all' | 'draft')}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                  filter === tab.id
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-[--text-muted] hover:text-foreground',
                )}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className="ml-1.5 font-mono opacity-60">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <Link
          href="/projects"
          className="text-xs font-mono text-[--text-muted] hover:text-foreground rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 transition-colors"
        >
          {t('dash_viewAllArrow')} →
        </Link>
      </div>

      {/* ── Grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {displayed.map(video => (
          <ProjectCard key={video.id} project={video} onDeleted={handleDeleted} />
        ))}

        {/* "+ New project" ghost card */}
        <button
          type="button"
          onClick={() => {
            // Trigger the TopBar "+ Create" dropdown if available, else navigate
            const btn = document.querySelector<HTMLButtonElement>('[data-new-project]')
            if (btn) btn.click()
            else router.push('/faceless/new')
          }}
          className={cn(
            'aspect-video rounded-2xl border-2 border-dashed',
            'border-border hover:border-primary/50',
            'bg-muted/30 hover:bg-accent/40',
            'flex flex-col items-center justify-center gap-2',
            'transition-all duration-200 group cursor-pointer',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
          )}
        >
          <div className={cn(
            'w-10 h-10 rounded-full bg-muted flex items-center justify-center',
            'group-hover:bg-accent transition-colors',
          )}>
            <Plus size={18} className="text-[--text-muted] group-hover:text-primary transition-colors" />
          </div>
          <span className="text-xs font-mono text-[--text-muted] group-hover:text-primary transition-colors">
            {t('dash_newProject')}
          </span>
        </button>
      </div>

      {/* Empty filter state */}
      {filtered.length === 0 && (
        <div className="py-8 text-center" role="status">
          <p className="font-body text-sm text-[--text-muted]">
            {filter === 'draft' ? t('dash_noDrafts') : t('dash_noProjects')}
          </p>
        </div>
      )}
    </section>
  )
}
