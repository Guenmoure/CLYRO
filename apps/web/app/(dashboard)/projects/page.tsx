'use client'

import { useState, useEffect, useCallback } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { ProjectCard } from '@/components/dashboard/ProjectCard'
import { FolderOpen, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 12

const MODULE_FILTERS = [
  { id: 'all',      label: 'Tout' },
  { id: 'faceless', label: 'Faceless' },
  { id: 'motion',   label: 'Motion' },
  { id: 'brand',    label: 'Brand' },
] as const

type ModuleFilter = typeof MODULE_FILTERS[number]['id']

export default function ProjectsPage() {
  const [videos, setVideos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [filter, setFilter] = useState<ModuleFilter>('all')

  const fetchVideos = useCallback(async (pageIndex: number, moduleFilter: ModuleFilter) => {
    setLoading(true)
    try {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const from = pageIndex * PAGE_SIZE
      const to   = from + PAGE_SIZE - 1

      let query = supabase
        .from('videos')
        .select('id, title, module, style, status, output_url, thumbnail_url, created_at', { count: 'exact' })
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .range(from, to)

      if (moduleFilter !== 'all') {
        query = query.eq('module', moduleFilter)
      }

      const { data, count, error } = await query

      if (!error && data) {
        setVideos(data)
        setTotal(count ?? 0)
        setHasMore(to < (count ?? 0) - 1)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setPage(0)
    fetchVideos(0, filter)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  useEffect(() => {
    fetchVideos(page, filter)
  }, [page, fetchVideos, filter])

  function handleDeleted(id: string) {
    setVideos((prev) => prev.filter((v) => v.id !== id))
    setTotal((prev) => prev - 1)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="flex-1 overflow-y-auto bg-background px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted] mb-1">Workspace</p>
            <h1 className="font-display text-2xl font-bold text-foreground">Bibliothèque</h1>
          </div>
          {!loading && total > 0 && (
            <span className="text-xs text-[--text-muted] font-mono bg-muted border border-border rounded-full px-3 py-1">
              {total} vidéo{total > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-1 bg-muted border border-border rounded-xl p-1 w-fit">
          {MODULE_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-colors',
                filter === f.id
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-[--text-muted] hover:text-foreground'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Loading skeleton */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-muted animate-pulse overflow-hidden border border-border">
                <div className="aspect-video bg-card" />
                <div className="p-3 space-y-1.5">
                  <div className="h-4 w-3/4 bg-card rounded" />
                  <div className="h-3 w-1/2 bg-card rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : !videos.length ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 px-8 text-center bg-muted/50 border border-dashed border-border rounded-2xl">
            <div className="w-14 h-14 rounded-2xl bg-muted border border-border flex items-center justify-center mb-4">
              <FolderOpen size={20} className="text-[--text-muted]" />
            </div>
            <p className="font-display text-sm font-semibold text-foreground mb-1">
              {filter !== 'all' ? `Aucun projet ${filter}` : 'Aucune vidéo générée'}
            </p>
            <p className="text-xs text-[--text-muted]">
              Crée ta première vidéo depuis{" "}
              <a href="/faceless/new" className="text-[--primary] hover:underline font-medium">Faceless</a>
              {" "}ou{" "}
              <a href="/motion/new" className="text-[--primary] hover:underline font-medium">Motion</a>.
            </p>
          </div>
        ) : (
          <>
            {/* Grid layout */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {videos.map((video) => (
                <ProjectCard key={video.id} project={video} onDeleted={handleDeleted} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between bg-muted border border-border rounded-xl px-4 py-3">
                <button
                  type="button"
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page === 0}
                  className="flex items-center gap-1.5 text-xs font-medium text-[--text-secondary] disabled:text-[--text-disabled] disabled:cursor-not-allowed hover:text-foreground transition-colors"
                >
                  <ChevronLeft size={14} />
                  Précédent
                </button>
                <span className="text-xs text-[--text-muted] font-mono">
                  Page {page + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!hasMore}
                  className="flex items-center gap-1.5 text-xs font-medium text-[--text-secondary] disabled:text-[--text-disabled] disabled:cursor-not-allowed hover:text-foreground transition-colors"
                >
                  Suivant
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
