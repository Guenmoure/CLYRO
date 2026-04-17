'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { ProjectCard } from '@/components/dashboard/ProjectCard'
import { DraftsSection } from '@/components/dashboard/DraftsSection'
import {
  Search, X, FolderOpen, SlidersHorizontal,
  FolderPlus, Trash2, ChevronDown, Folder,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 12

const SORT_OPTIONS = [
  { id: 'recent', label: 'Newest'    },
  { id: 'oldest', label: 'Oldest'    },
  { id: 'status', label: 'By Status' },
] as const

type SortOption = typeof SORT_OPTIONS[number]['id']

interface VideoRow {
  id: string
  title: string | null
  module: string | null
  style: string | null
  status: string
  output_url: string | null
  thumbnail_url?: string | null
  created_at: string
  duration_seconds?: number | null
  created_by?: string | null
}

export default function ProjectsPage() {
  const [videos,  setVideos]  = useState<VideoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [page,    setPage]    = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [total,   setTotal]   = useState(0)
  const [sort,    setSort]    = useState<SortOption>('recent')
  const [search,  setSearch]  = useState('')
  const [folders, setFolders] = useState<string[]>(['Richard'])

  const fetchVideos = useCallback(async (pageIndex: number, sortOption: SortOption) => {
    setLoading(true)
    try {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const from = pageIndex * PAGE_SIZE
      const to   = from + PAGE_SIZE - 1

      let query = supabase
        .from('videos')
        .select('id, title, module, style, status, output_url, created_at', { count: 'exact' })
        .eq('user_id', session.user.id)
        .neq('status', 'draft')   // drafts shown separately above
        .range(from, to)

      if (sortOption === 'recent') {
        query = query.order('created_at', { ascending: false })
      } else if (sortOption === 'oldest') {
        query = query.order('created_at', { ascending: true })
      } else {
        query = query.order('status', { ascending: true }).order('created_at', { ascending: false })
      }

      const { data, count, error } = await query
      if (error) {
        console.error('[projects] Supabase query error:', error)
      }
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
    fetchVideos(0, sort)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort])

  useEffect(() => {
    fetchVideos(page, sort)
  }, [page, fetchVideos, sort])

  function handleDeleted(id: string) {
    setVideos((prev) => prev.filter((v) => v.id !== id))
    setTotal((prev) => prev - 1)
  }

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
      <div className="max-w-6xl mx-auto space-y-8">

        {/* ── Brouillons ───────────────────────────────────────── */}
        <DraftsSection />

        {/* ── Header row ───────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-bold text-foreground shrink-0">Projects</h1>

          {/* Search */}
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[--text-muted] pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search videos and folders"
              aria-label="Search videos and folders"
              className="w-full pl-10 pr-9 py-2.5 glass rounded-xl text-sm font-body text-foreground placeholder:text-[--text-muted] focus:outline-none focus:ring-1 focus:ring-blue-500/40 transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[--text-muted] hover:text-foreground"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filters */}
          <button
            type="button"
            className="glass rounded-xl px-4 py-2.5 font-body text-sm flex items-center gap-2 text-foreground shrink-0 hover:bg-white/5 transition-colors"
          >
            <SlidersHorizontal size={15} />
            Filters
            <span className="text-[--text-muted]">0</span>
          </button>

          {/* Sort */}
          <label className={cn('glass rounded-xl px-4 py-2.5 font-body text-sm flex items-center gap-2 text-foreground shrink-0 cursor-pointer')}>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              aria-label="Sort projects"
              className="bg-transparent text-foreground focus:outline-none cursor-pointer appearance-none"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="text-[--text-muted] pointer-events-none shrink-0" />
          </label>
        </div>

        {/* ── Folders section ──────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="font-display text-base font-semibold text-foreground">Folders</h2>
            <button
              type="button"
              aria-label="New folder"
              onClick={() => setFolders((prev) => [...prev, `Folder ${prev.length + 1}`])}
              className="w-7 h-7 rounded-lg border border-border bg-card hover:bg-muted flex items-center justify-center text-[--text-muted] hover:text-foreground transition-colors"
            >
              <FolderPlus size={14} />
            </button>
            <button
              type="button"
              aria-label="Delete selected folder"
              className="w-7 h-7 rounded-lg border border-border bg-card hover:bg-muted flex items-center justify-center text-[--text-muted] hover:text-error transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>

          {folders.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {folders.map((name) => (
                <div
                  key={name}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl border border-border bg-card hover:bg-muted transition-colors font-body text-sm text-foreground cursor-pointer select-none"
                >
                  <Folder size={16} className="text-[--text-muted]" />
                  {name}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[--text-muted] font-mono">No folders yet.</p>
          )}
        </section>

        {/* ── Videos section ───────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-base font-semibold text-foreground">Videos</h2>
            {!loading && total > 0 && (
              <span className="text-xs text-[--text-muted] font-mono bg-muted border border-border rounded-full px-3 py-1">
                {total} video{total > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
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
            <div className="flex flex-col items-center justify-center py-20 px-8 text-center bg-muted/50 border border-dashed border-border rounded-2xl">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-border flex items-center justify-center mb-4">
                <FolderOpen size={28} className="text-blue-500" />
              </div>
              <p className="font-display text-lg font-semibold text-foreground mb-2">
                {search ? `No results for "${search}"` : 'Your library is empty'}
              </p>
              <p className="text-sm text-[--text-muted] max-w-sm">
                {search
                  ? 'Try a different term or clear the search.'
                  : 'Create your first video to see it here.'}
              </p>
              {!search && (
                <div className="flex items-center gap-3 mt-5">
                  <a
                    href="/faceless/new"
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-2 font-display text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                  >
                    New Faceless Video
                  </a>
                  <a
                    href="/motion/new"
                    className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 font-display text-sm font-semibold text-foreground hover:bg-muted transition-colors"
                  >
                    Motion Design
                  </a>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((video) => (
                  <ProjectCard key={video.id} project={video} onDeleted={handleDeleted} />
                ))}
              </div>

              {totalPages > 1 && !search && (
                <div className="flex items-center justify-between bg-muted border border-border rounded-xl px-4 py-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setPage((p) => p - 1)}
                    disabled={page === 0}
                    className="flex items-center gap-1.5 text-xs font-medium text-[--text-muted] disabled:text-[--text-disabled] disabled:cursor-not-allowed hover:text-foreground transition-colors"
                  >
                    <ChevronLeft size={14} /> Previous
                  </button>
                  <span className="text-xs text-[--text-muted] font-mono">
                    Page {page + 1} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!hasMore}
                    className="flex items-center gap-1.5 text-xs font-medium text-[--text-muted] disabled:text-[--text-disabled] disabled:cursor-not-allowed hover:text-foreground transition-colors"
                  >
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </>
          )}
        </section>

      </div>
    </div>
  )
}
