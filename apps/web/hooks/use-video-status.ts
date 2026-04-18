'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import type { VideoStatus } from '@clyro/shared'

interface VideoStatusState {
  status: VideoStatus
  progress: number
  outputUrl: string | null
  errorMessage: string | null
}

interface UseVideoStatusReturn extends VideoStatusState {
  isLoading: boolean
  isDone: boolean
  isError: boolean
}

const TERMINAL = new Set<VideoStatus>(['done', 'error'])

/**
 * Hook de suivi temps-réel d'une génération vidéo.
 *
 * Stratégie double-couche :
 *  1. SSE (primaire)     — polling server-side toutes les 2 s via /api/v1/videos/:id/status
 *  2. Supabase Realtime  — fallback si SSE échoue (réseau instable, page en arrière-plan)
 *
 * La reconnexion SSE est automatique avec backoff exponentiel (max 30 s).
 * Quand le statut terminal (done/error) est atteint, toutes les connexions se ferment.
 */
export function useVideoStatus(videoId: string | null): UseVideoStatusReturn {
  const supabase = createBrowserClient()

  const [state, setState] = useState<VideoStatusState>({
    status: 'pending',
    progress: 0,
    outputUrl: null,
    errorMessage: null,
  })

  const esRef        = useRef<EventSource | null>(null)
  const retryTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryCount   = useRef(0)
  const isDoneRef    = useRef(false)

  const applyData = useCallback((data: {
    status: VideoStatus
    progress?: number
    output_url?: string | null
    error_message?: string | null
  }) => {
    setState({
      status:       data.status,
      progress:     data.progress ?? 0,
      outputUrl:    data.output_url ?? null,
      errorMessage: data.error_message ?? null,
    })
    if (TERMINAL.has(data.status)) {
      isDoneRef.current = true
    }
  }, [])

  // ── SSE ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!videoId) return
    isDoneRef.current = false
    retryCount.current = 0

    let cancelled = false

    async function connect() {
      if (cancelled || isDoneRef.current) return

      const { data: { session } } = await supabase.auth.getSession()
      if (!session || cancelled) return

      const token = encodeURIComponent(session.access_token)
      // Use the Next.js proxy to avoid CORS issues when calling Render from Vercel
      const url   = `/api/videos/${videoId}/status?token=${token}`

      const es = new EventSource(url)
      esRef.current = es

      es.onmessage = (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data as string) as {
            status: VideoStatus
            progress?: number
            output_url?: string | null
            error_message?: string | null
          }
          applyData(data)
          if (TERMINAL.has(data.status)) {
            es.close()
          }
        } catch { /* ignore parse errors */ }
      }

      es.onerror = () => {
        es.close()
        esRef.current = null
        if (cancelled || isDoneRef.current) return
        // Backoff exponentiel : 2s, 4s, 8s … max 30s
        const delay = Math.min(2000 * Math.pow(2, retryCount.current), 30_000)
        retryCount.current++
        retryTimer.current = setTimeout(connect, delay)
      }
    }

    connect()

    return () => {
      cancelled = true
      esRef.current?.close()
      esRef.current = null
      if (retryTimer.current) clearTimeout(retryTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId])

  // ── Supabase Realtime (fallback) ─────────────────────────────────────────────
  useEffect(() => {
    if (!videoId) return

    const channel = supabase
      .channel(`video-status-${videoId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'videos',
          filter: `id=eq.${videoId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          const row = payload.new as {
            status: VideoStatus
            output_url?: string | null
            metadata?: { progress?: number; error_message?: string } | null
          }
          applyData({
            status:       row.status,
            progress:     row.metadata?.progress ?? 0,
            output_url:   row.output_url ?? null,
            error_message: row.metadata?.error_message ?? null,
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId])

  return {
    ...state,
    isLoading: !TERMINAL.has(state.status),
    isDone:    state.status === 'done',
    isError:   state.status === 'error',
  }
}
