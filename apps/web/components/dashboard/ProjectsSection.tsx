'use client'

/**
 * ProjectsSection — filterable grid of recent projects.
 *
 * Filter tabs: All | Drafts
 * Grid: up to 10 projects + a "+ New" card at the end.
 * Clicking a project navigates to the video page or resumes a draft.
 *
 * Replaces the old ProjectSectionsClient + RecentProjects + DraftsSection pattern.
 * The parent (page.tsx) passes SSR-fetched videos directly; this component only
 * needs to filter and display them client-side (no extra fetches).
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ProjectCard } from './ProjectCard'
import type { VideoProject } from './ProjectCard'

// ── Props ──────────────────────────────────────────────────────────────────────

interface ProjectsSectionProps {
  videos:     VideoProject[]
  draftCount: number
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ProjectsSection({ videos, draftCount }: ProjectsSectionProps) {
  const router = useRouter()
  const [filter, setFilter] = useState<'all' | 'draft'>('all')

  const filtered = filter === 'draft'
    ? videos.filter(v => v.status === 'draft')
    : videos

  const displayed = filtered.slice(0, 10)

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-base font-semibold text-foreground">
            My Projects
          </h2>

          {/* Filter tabs */}
          <div className="flex items-center gap-0.5 p-0.5 rounded-xl bg-muted">
            {[
              { id: 'all',   label: 'All',    count: videos.length },
              { id: 'draft', label: 'Drafts', count: draftCount },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id as 'all' | 'draft')}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50',
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

        <button
          type="button"
          onClick={() => router.push('/projects')}
          className="text-xs font-mono text-[--text-muted] hover:text-foreground transition-colors"
        >
          View all →
        </button>
      </div>

      {/* ── Grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {displayed.map(video => (
          <ProjectCard key={video.id} project={video} />
        ))}

        {/* "+ New project" ghost card */}
        <button
          type="button"
          onClick={() => {
            // Trigger the header dropdown if available, else navigate
            const btn = document.querySelector<HTMLButtonElement>('[data-new-project]')
            if (btn) btn.click()
            else router.push('/faceless/new')
          }}
          className={cn(
            'aspect-video rounded-2xl border-2 border-dashed',
            'border-border hover:border-blue-500/50',
            'bg-muted/30 hover:bg-blue-500/5',
            'flex flex-col items-center justify-center gap-2',
            'transition-all duration-200 group cursor-pointer',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50',
          )}
        >
          <div className={cn(
            'w-10 h-10 rounded-full bg-muted flex items-center justify-center',
            'group-hover:bg-blue-500/15 transition-colors',
          )}>
            <Plus size={18} className="text-[--text-muted] group-hover:text-blue-500 transition-colors" />
          </div>
          <span className="text-xs font-mono text-[--text-muted] group-hover:text-blue-500 transition-colors">
            New project
          </span>
        </button>
      </div>

      {/* Empty filter state */}
      {filtered.length === 0 && (
        <div className="py-8 text-center">
          <p className="font-body text-sm text-[--text-muted]">
            {filter === 'draft' ? 'No drafts yet.' : 'No projects yet.'}
          </p>
        </div>
      )}
    </div>
  )
}
