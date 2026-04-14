'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { ProjectCard } from '@/components/dashboard/ProjectCard'
import { FolderOpen, ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 12

const MODULE_FILTERS = [
  { id: 'all',      label: 'Tout' },
  { id: 'faceless', label: 'Faceless' },
  { id: 'motion',   label: 'Motion' },
  { id: 'brand',    label: 'Brand' },
] as const

const SORT_OPTIONS = [
  { id: 'recent',  label: 'Plus récents' },
  { id: 'oldest',  label: 'Plus anciens' },
  { id: 'status',  label: 'Par statut' },
] as const

type ModuleFilter = typeof MODULE_FILTERS[number]['id']
type SortOption   = typeof SORT_OPTIONS[number]['id']

interface VideoRow {
  id: string
  title: string | null
  module: string | null
  style: string | null
  status: string
  output_url: string | null
  thumbnail_url?: string | null
  created_at: string
}

export default function ProjectsPage() {
  const [videos, setVideos] = useState<VideoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [filter, setFilter] = useState<ModuleFilter>('all')
  const [sort, setSort]     = useState<SortOption>('recent')
  const [search, setSearch] = useState('')

  const fetchVideos = useCallback(async (pageIndex: number, moduleFilter: ModuleFilter, sortOption: SortOption) => {
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
        .range(from, to)

      // Sort
      if (sortOption === 'recent') {
        query = query.order('created_at', { ascending: false })
      } else if (sortOption === 'oldest') {
        query = query.order('created_at', { ascending: true })
      } else if (sortOption === 'status') {
        query = query.order('status', { ascending: true }).order('created_at', { ascending: false })
      }

      if (moduleFilter !== 'all') {
        query = query.eq('module', moduleFilter)
      }

      const { data, count, error } = await query

      if (!error && data) {
        setVideos(data as VideoRow[])
        setTotal(count ?? 0)
        setHasMore(to < (count ?? 0) - 1)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setPage(0)
    fetchVideos(0, filter, sort)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, sort])

  useEffect(() => {
    fetchVideos(page, filter, sort)
  }, [page, fetchVideos, filter, sort])

  function handleDeleted(id: string) {
    setVideos((prev) => prev.filter((v) => v.id !== id))
    setTotal((prev) => prev - 1)
  }

  // Client-side search filter (on the current page results)
  const filtered = useMemo(() => {
    if (!search.trim()) return videos
    const q = search.toLowerCase()
    return videos.filter((v) =>
      v.title?.toLowerCase().includes(q) ||
      v.module?.toLowerCase().includes(q) ||
      v.style?.toLowerCase().includes(q)
    )
  }, [videos, search])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="flex-1 overflow-y-auto bg-background px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Page header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-[--text-secondary] font-semibold mb-1">Workspace</p>
            <h1 className="font-display text-3xl font-bold text-foreground">Bibliothèque</h1>
          </div>
          {!loading && total > 0 && (
            <span className="text-xs text-[--text-secondary] font-mono bg-muted border border-border rounded-full px-3 py-1">
              {total} vidéo{total > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Toolbar: search + filters + sort */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Search box */}
          <div className="relative md:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[--text-secondary]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Chercher par titre, module, style…"
              className="w-full pl-9 pr-9 py-2 rounded-xl bg-muted border border-border text-sm font-body text-foreground placeholder:text-[--text-secondary] focus:outline-none focus:border-blue-500/50 transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Effacer la recherche"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[--text-secondary] hover:text-foreground"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Sort dropdown */}
            <label className="inline-flex items-center gap-2 bg-muted border border-border rounded-xl px-3 py-2 text-xs font-body text-[--text-secondary]">
              Trier :
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
                className="bg-transparent font-medium text-foreground focus:outline-none cursor-pointer"
                aria-label="Trier les projets"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </label>

            {/* Filter pills */}
            <div className="flex items-center gap-1 bg-muted border border-border rounded-xl p-1">
              {MODULE_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-colors',
                    filter === f.id
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-[--text-secondary] hover:text-foreground'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
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
        ) : !filtered.length ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 px-8 text-center bg-muted/50 border border-dashed border-border rounded-2xl">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-border flex items-center justify-center mb-4">
              <FolderOpen size={28} className="text-blue-500" />
            </div>
            <p className="font-display text-lg font-semibold text-foreground mb-2">
              {search ? `Aucun résultat pour "${search}"` :
                filter !== 'all' ? `Aucun projet ${filter}` :
                'Ta bibliothèque est vide'}
            </p>
            <p className="text-sm text-[--text-secondary] max-w-sm">
              {search
                ? 'Essaie un autre terme ou change de filtre.'
                : 'Crée ta première vidéo pour la voir apparaître ici.'}
            </p>
            {!search && (
              <div className="flex items-center gap-3 mt-5">
                <a
                  href="/faceless/new"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-2 font-display text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                >
                  Nouvelle vidéo Faceless
                </a>
                <a
                  href="/motion/new"
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 font-display text-sm font-semibold text-foreground hover:border-border hover:bg-muted transition-colors"
                >
                  Motion Design
                </a>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Grid layout */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {filtered.map((video) => (
                <ProjectCard key={video.id} project={video} onDeleted={handleDeleted} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && !search && (
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
                <span className="text-xs text-[--text-secondary] font-mono">
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

            {/* Search narrowed results hint */}
            {search && filtered.length < videos.length && (
              <p className="text-center text-xs text-[--text-secondary] font-mono">
                {filtered.length} résultat{filtered.length > 1 ? 's' : ''} sur cette page ·
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="ml-1 text-blue-500 hover:underline"
                >
                  voir tous
                </button>
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
