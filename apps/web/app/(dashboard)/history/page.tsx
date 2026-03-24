'use client'

import { useState, useEffect, useCallback } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { VideoCard, type VideoItem } from '@/components/shared/video-card'

const PAGE_SIZE = 10

export default function HistoryPage() {
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)

  const fetchVideos = useCallback(async (pageIndex: number) => {
    setLoading(true)
    try {
      const supabase = createBrowserClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const from = pageIndex * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      const { data, count, error } = await supabase
        .from('videos')
        .select('id, title, module, style, status, output_url, created_at', { count: 'exact' })
        .eq('user_id', user.id)
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

  useEffect(() => {
    fetchVideos(page)
  }, [fetchVideos, page])

  function handleDeleted(id: string) {
    setVideos((prev) => prev.filter((v) => v.id !== id))
    setTotal((prev) => prev - 1)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-end justify-between">
        <div>
          <p className="label-mono mb-1">Historique</p>
          <h1 className="font-display text-2xl font-bold text-foreground">Mes vidéos</h1>
        </div>
        {!loading && total > 0 && (
          <p className="font-mono text-xs text-muted-foreground">
            {total} vidéo{total > 1 ? 's' : ''}
          </p>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-navy-900 border border-border rounded-xl p-4 flex items-center gap-4 animate-pulse"
            >
              <div className="w-14 h-14 bg-navy-800 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-navy-800 rounded w-1/3" />
                <div className="h-3 bg-navy-800 rounded w-1/2" />
              </div>
              <div className="h-6 bg-navy-800 rounded-full w-20" />
            </div>
          ))}
        </div>
      ) : !videos.length ? (
        <div className="bg-navy-900 border border-border rounded-xl p-12 text-center">
          <p className="font-display text-muted-foreground text-lg mb-2">Aucune vidéo générée</p>
          <p className="font-body text-sm text-muted-foreground">
            Crée ta première vidéo depuis le module{' '}
            <a href="/faceless/new" className="text-clyro-blue hover:underline">
              Faceless
            </a>{' '}
            ou{' '}
            <a href="/motion/new" className="text-clyro-blue hover:underline">
              Motion
            </a>
            .
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
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 0}
                className="font-mono text-xs text-clyro-blue disabled:text-muted-foreground disabled:cursor-not-allowed hover:underline"
              >
                ← Précédent
              </button>

              <span className="font-mono text-xs text-muted-foreground">
                Page {page + 1} / {totalPages}
              </span>

              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!hasMore}
                className="font-mono text-xs text-clyro-blue disabled:text-muted-foreground disabled:cursor-not-allowed hover:underline"
              >
                Suivant →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
