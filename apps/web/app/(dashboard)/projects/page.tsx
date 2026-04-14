'use client'

import { useState, useEffect, useCallback } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { VideoCard, type VideoItem } from '@/components/shared/video-card'
import { FolderOpen } from 'lucide-react'

const PAGE_SIZE = 10

export default function ProjectsPage() {
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)

  const fetchVideos = useCallback(async (pageIndex: number) => {
    setLoading(true)
    try {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const from = pageIndex * PAGE_SIZE
      const to   = from + PAGE_SIZE - 1

      const { data, count, error } = await supabase
        .from('videos')
        .select('id, title, module, style, status, output_url, created_at', { count: 'exact' })
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .range(from, to)

      if (!error && data) {
        setVideos(data as VideoItem[])
        setTotal(count ?? 0)
        setHasMore(to < (count ?? 0) - 1)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchVideos(page) }, [fetchVideos, page])

  function handleDeleted(id: string) {
    setVideos((prev) => prev.filter((v) => v.id !== id))
    setTotal((prev) => prev - 1)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="flex-1 overflow-y-auto bg-background px-8 py-8">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[--text-muted] mb-1">Historique</p>
            <h1 className="text-2xl font-bold text-foreground">Projects</h1>
          </div>
          {!loading && total > 0 && (
            <span className="text-xs text-[--text-muted] font-mono bg-muted border border-border rounded-full px-3 py-1">
              {total} vidéo{total > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Loading skeleton */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-muted border border-border rounded-xl p-4 flex items-center gap-4 animate-pulse">
                <div className="w-14 h-14 bg-card rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-card rounded w-1/3" />
                  <div className="h-3 bg-card rounded w-1/2" />
                </div>
                <div className="h-6 bg-card rounded-full w-20" />
              </div>
            ))}
          </div>
        ) : !videos.length ? (
          /* Empty state */
          <div className="bg-muted border border-border rounded-2xl p-16 text-center">
            <div className="w-12 h-12 rounded-full bg-card border border-border flex items-center justify-center mx-auto mb-3">
              <FolderOpen size={18} className="text-[--text-muted]" />
            </div>
            <p className="text-sm font-semibold text-foreground mb-1">Aucune vidéo générée</p>
            <p className="text-xs text-[--text-muted]">
              Crée ta première vidéo depuis{' '}
              <a href="/faceless" className="text-purple-400 hover:underline font-medium">Faceless</a>
              {' '}ou{' '}
              <a href="/motion" className="text-purple-400 hover:underline font-medium">Motion</a>.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {videos.map((video) => (
                <VideoCard key={video.id} video={video} onDeleted={handleDeleted} />
              ))}
            </div>
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between bg-muted border border-border rounded-xl px-4 py-3">
                <button
                  type="button"
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page === 0}
                  className="text-xs font-medium text-purple-400 disabled:text-[--text-muted] disabled:cursor-not-allowed hover:text-purple-300 transition-colors"
                >
                  ← Précédent
                </button>
                <span className="text-xs text-[--text-muted]">Page {page + 1} / {totalPages}</span>
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!hasMore}
                  className="text-xs font-medium text-purple-400 disabled:text-[--text-muted] disabled:cursor-not-allowed hover:text-purple-300 transition-colors"
                >
                  Suivant →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
